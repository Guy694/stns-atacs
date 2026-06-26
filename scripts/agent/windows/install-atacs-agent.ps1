param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,

    [string]$EnrollmentToken,

    [int]$FacilityId,

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

Write-Host "Running first enrollment and inventory report..."
$enrollArgs = @("-ExecutionPolicy", "Bypass", "-File", $agentScriptTarget, "-ApiBaseUrl", $ApiBaseUrl, "-ConfigPath", $configPath, "-RunOnce")
if ($hasToken) {
    $enrollArgs += @("-EnrollmentToken", $EnrollmentToken)
}
else {
    $enrollArgs += @("-FacilityId", $FacilityId, "-InstallKey", $InstallKey)
    if (-not [string]::IsNullOrWhiteSpace($WorkGroupName)) {
        $enrollArgs += @("-WorkGroupName", $WorkGroupName)
    }
}
powershell.exe @enrollArgs

$taskCommand = "powershell.exe"
$taskArgs = "-ExecutionPolicy Bypass -File `"$agentScriptTarget`" -ConfigPath `"$configPath`" -RunOnce"

function Register-TaskWithSchtasksFallback {
    $taskRun = "$taskCommand $taskArgs"
    if ($isAdmin) {
        schtasks.exe /Create /TN "$taskName" /SC HOURLY /MO 4 /TR "$taskRun" /RU "SYSTEM" /F | Out-Null
    }
    else {
        schtasks.exe /Create /TN "$taskName" /SC HOURLY /MO 4 /TR "$taskRun" /F | Out-Null
    }
}

try {
    $action = New-ScheduledTaskAction -Execute $taskCommand -Argument $taskArgs
    $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date
    $triggerRepeat.Repetition = New-ScheduledTaskRepetitionSettingsSet -Interval (New-TimeSpan -Hours 4) -Duration ([TimeSpan]::MaxValue)
    if ($isAdmin) {
        $triggerStartup = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $triggers = @($triggerStartup, $triggerRepeat)
    }
    else {
        $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
        $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
        $triggers = @($triggerLogon, $triggerRepeat)
    }
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Scheduled task '$taskName' created successfully."
}
catch {
    Write-Warning "Unable to create scheduled task automatically. Run PowerShell as Administrator and try again if needed."
    Write-Warning $_
    try {
        Register-TaskWithSchtasksFallback
        Write-Host "Scheduled task '$taskName' created with schtasks fallback."
    }
    catch {
        Write-Warning "Fallback with schtasks also failed."
        Write-Warning $_
    }
}

Write-Host "Install completed. Files stored in $InstallRoot"
Write-Host "Config file: $configPath"
