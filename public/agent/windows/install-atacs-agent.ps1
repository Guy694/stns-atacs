param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,

    [string]$EnrollmentToken,

    [int]$FacilityId,

    [int]$WorkGroupId,

    [string]$WorkGroupName,

    [string]$InstallKey,

    [string]$InstallRoot = "$env:ProgramData\ATACSAgent"
)

$ErrorActionPreference = "Stop"

$hasToken = -not [string]::IsNullOrWhiteSpace($EnrollmentToken)
$hasStaticInstall = -not [string]::IsNullOrWhiteSpace($InstallKey) -and $FacilityId -gt 0
if (-not $hasToken -and -not $hasStaticInstall) {
    throw "EnrollmentToken or InstallKey + FacilityId is required."
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$isAdmin = Test-IsAdministrator
if (-not $isAdmin -and $InstallRoot -eq "$env:ProgramData\ATACSAgent") {
    $InstallRoot = "$env:LOCALAPPDATA\ATACSAgent"
    Write-Warning "Not running as Administrator. Using per-user install path: $InstallRoot"
}

$agentScriptSource = Join-Path $PSScriptRoot "atacs-agent.ps1"
$agentScriptTarget = Join-Path $InstallRoot "atacs-agent.ps1"
$configPath = Join-Path $InstallRoot "agent-config.json"
$taskName = "ATACS Agent Inventory"

if (-not (Test-Path $agentScriptSource)) {
    throw "Cannot find atacs-agent.ps1 next to the installer script."
}

if (-not (Test-Path $InstallRoot)) {
    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
}

Copy-Item -Path $agentScriptSource -Destination $agentScriptTarget -Force

Write-Host "Enrolling this machine..."
# G3: ลงทะเบียนแยกจากการส่งรายงานแรก และตรวจผลก่อนตั้ง Scheduled Task — ลงทะเบียนไม่สำเร็จต้องหยุดทันที
$enrollArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $agentScriptTarget, "-ApiBaseUrl", $ApiBaseUrl, "-ConfigPath", $configPath, "-EnrollOnly")
if ($hasToken) {
    $enrollArgs += @("-EnrollmentToken", $EnrollmentToken)
}
else {
    $enrollArgs += @("-FacilityId", $FacilityId, "-InstallKey", $InstallKey)
    if ($WorkGroupId -gt 0) {
        $enrollArgs += @("-WorkGroupId", $WorkGroupId)
    }
    if (-not [string]::IsNullOrWhiteSpace($WorkGroupName)) {
        $enrollArgs += @("-WorkGroupName", $WorkGroupName)
    }
}
& powershell.exe @enrollArgs
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $configPath)) {
    throw "Enrollment failed (exit code $LASTEXITCODE). The scheduled task was not created. Check the enrollment token/install key and network access, then run the installer again."
}

Write-Host "Sending the first inventory report..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agentScriptTarget -ConfigPath $configPath -RunOnce
if ($LASTEXITCODE -ne 0) {
    Write-Warning "The first inventory report failed (exit code $LASTEXITCODE). The scheduled task will retry."
}

$taskCommand = "powershell.exe"
$taskArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScriptTarget`" -ConfigPath `"$configPath`" -RunOnce"
$currentUser = "$env:USERDOMAIN\$env:USERNAME"

function Register-TaskWithSchtasksFallback {
    $taskRun = "$taskCommand $taskArgs"
    # Windows PowerShell 5.1 ส่งเครื่องหมาย " ภายใน argument ให้โปรแกรมภายนอกโดยไม่ escape ต้องใส่ \" เอง
    $legacyArgumentPassing = -not (Get-Variable -Name PSNativeCommandArgumentPassing -ErrorAction SilentlyContinue) -or
        $PSNativeCommandArgumentPassing -eq "Legacy"
    if ($legacyArgumentPassing) { $taskRun = $taskRun.Replace('"', '\"') }
    if ($isAdmin) {
        schtasks.exe /Create /TN "$taskName" /SC HOURLY /MO 4 /TR "$taskRun" /RU "SYSTEM" /RL HIGHEST /F | Out-Null
    }
    else {
        schtasks.exe /Create /TN "$taskName" /SC HOURLY /MO 4 /TR "$taskRun" /F | Out-Null
    }
    if ($LASTEXITCODE -ne 0) {
        throw "schtasks.exe /Create failed with exit code $LASTEXITCODE"
    }
}

try {
    $action = New-ScheduledTaskAction -Execute $taskCommand -Argument $taskArgs
    # G2: ทำงานซ้ำทุก 4 ชม. ด้วย cmdlet ที่มีจริงใน Windows PowerShell 5.1 (New-ScheduledTaskTrigger -RepetitionInterval)
    # ใช้ระยะเวลาจำกัดที่ยาวมาก (10 ปี) แทน [TimeSpan]::MaxValue ซึ่ง Windows 10+ ปฏิเสธว่า XML ไม่ถูกต้อง
    $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration (New-TimeSpan -Days 3650)
    if ($isAdmin) {
        $triggerStartup = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $triggers = @($triggerStartup, $triggerRepeat)
    }
    else {
        # ผู้ใช้ทั่วไปสร้าง trigger "เมื่อผู้ใช้ใดก็ได้ logon" ไม่ได้ ต้องระบุบัญชีตัวเอง
        $triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
        $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
        $triggers = @($triggerLogon, $triggerRepeat)
    }
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
    Write-Host "Scheduled task '$taskName' created successfully."
}
catch {
    Write-Warning "Register-ScheduledTask failed: $_"
    Write-Warning "Trying schtasks.exe instead..."
    try {
        Register-TaskWithSchtasksFallback
        Write-Host "Scheduled task '$taskName' created with schtasks fallback."
    }
    catch {
        throw "Unable to create the scheduled task '$taskName' ($_). The agent is enrolled but will not report automatically. Run PowerShell as Administrator and install again."
    }
}

Write-Host "Install completed. Files stored in $InstallRoot"
Write-Host "Config file: $configPath"
