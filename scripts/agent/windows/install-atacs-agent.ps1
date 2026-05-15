param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken,

    [string]$InstallRoot = "$env:ProgramData\ATACSAgent"
)

$ErrorActionPreference = "Stop"
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
powershell.exe -ExecutionPolicy Bypass -File $agentScriptTarget -ApiBaseUrl $ApiBaseUrl -EnrollmentToken $EnrollmentToken -ConfigPath $configPath -RunOnce

$taskCommand = "powershell.exe"
$taskArgs = "-ExecutionPolicy Bypass -File `"$agentScriptTarget`" -ConfigPath `"$configPath`" -RunOnce"

try {
    $action = New-ScheduledTaskAction -Execute $taskCommand -Argument $taskArgs
    $triggerStartup = New-ScheduledTaskTrigger -AtStartup
    $triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date
    $triggerRepeat.Repetition = New-ScheduledTaskRepetitionSettingsSet -Interval (New-TimeSpan -Hours 4) -Duration ([TimeSpan]::MaxValue)
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerStartup, $triggerRepeat) -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Scheduled task '$taskName' created successfully."
}
catch {
    Write-Warning "Unable to create scheduled task automatically. Run PowerShell as Administrator and try again if needed."
    Write-Warning $_
}

Write-Host "Install completed. Files stored in $InstallRoot"
Write-Host "Config file: $configPath"
