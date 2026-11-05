param(
    # Default: the folders install-atacs-agent.ps1 uses (Administrator -> ProgramData, otherwise LOCALAPPDATA).
    [string]$InstallRoot,

    [string]$ConfigPath,

    # If the config still exists, tell the ATACS server first so the device shows "uninstalled" and its key is revoked.
    [switch]$NotifyServer
)

# ATACS Windows agent: manual uninstall (works for every agent version). Windows PowerShell 5.1 compatible.
# Removes the scheduled task "ATACS Agent Inventory" (Register-ScheduledTask or schtasks.exe fallback),
# the config with the agent key, and the install folder.

$ErrorActionPreference = "Continue"
$taskName = "ATACS Agent Inventory"

function Test-IsAdministrator {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    catch { return $false }
}

function Test-SafeInstallRoot {
    param([string]$Path)
    if (-not $Path) { return $false }
    try { $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\') } catch { return $false }
    $root = ([System.IO.Path]::GetPathRoot($full)).TrimEnd('\')
    if ($full.Length -lt 4 -or $full -ieq $root) { return $false }
    foreach ($shared in @($env:SystemRoot, $env:ProgramData, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA, $env:APPDATA, $env:USERPROFILE, $env:TEMP, $env:PUBLIC)) {
        if ($shared -and $full -ieq ([string]$shared).TrimEnd('\')) { return $false }
    }
    return $true
}

function Send-ManualUninstallNotice {
    param([string]$Path)
    try {
        $config = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
        $base = ([string]$config.apiBaseUrl).Trim().TrimEnd('/')
        $uri = [Uri]$base
        $localDev = $uri.Scheme -eq 'http' -and ($uri.Host -eq 'localhost' -or $uri.Host -eq '127.0.0.1')
        if ($uri.Scheme -ne 'https' -and -not $localDev) { Write-Warning "Not notifying a non-https server: $base"; return }
        try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
        $headers = @{ "x-agent-id" = [string]$config.agentId; "x-agent-key" = [string]$config.agentKey }
        $body = [System.Text.Encoding]::UTF8.GetBytes((@{ reason = "manual" } | ConvertTo-Json))
        $response = Invoke-RestMethod -Method Post -Uri "$base/api/agent/uninstalled/" -ContentType "application/json; charset=utf-8" -Headers $headers -Body $body -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($response.ok) { Write-Host "Server notified: device marked as uninstalled." }
    }
    catch {
        Write-Warning "Could not notify the server ($($_.Exception.Message)); continuing. Use 'retire' in ATACS if the device still shows as installed."
    }
}

$isAdmin = Test-IsAdministrator
if (-not $isAdmin) {
    Write-Warning "Not running as Administrator: only a per-user install can be removed. Run PowerShell as Administrator for the normal install."
}

$roots = @()
if ($InstallRoot) { $roots += $InstallRoot }
else { $roots += @("$env:ProgramData\ATACSAgent", "$env:LOCALAPPDATA\ATACSAgent") }

$configFiles = @()
if ($ConfigPath) { $configFiles += $ConfigPath }
foreach ($root in $roots) { $configFiles += (Join-Path $root "agent-config.json") }
$configFiles = @($configFiles | Where-Object { $_ } | Select-Object -Unique)

if ($NotifyServer) {
    $existing = $configFiles | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($existing) { Write-Host "Notifying the ATACS server..."; Send-ManualUninstallNotice -Path $existing }
    else { Write-Host "No agent config found; skipping server notification." }
}

# Secrets first: the config holds the agent key.
foreach ($file in $configFiles) {
    if (Test-Path -LiteralPath $file) {
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $file) { Write-Warning "Could not remove $file" } else { Write-Host "Removed config: $file" }
    }
}

$taskRemoved = $false
try {
    if (Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue) {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
            $taskRemoved = $true
        }
    }
}
catch { Write-Warning "Unregister-ScheduledTask failed: $($_.Exception.Message)" }
try {
    & schtasks.exe /Query /TN "$taskName" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & schtasks.exe /Delete /TN "$taskName" /F 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $taskRemoved = $true } else { Write-Warning "schtasks.exe /Delete failed with exit code $LASTEXITCODE" }
    }
}
catch { Write-Warning "schtasks.exe failed: $($_.Exception.Message)" }
if ($taskRemoved) { Write-Host "Removed scheduled task: $taskName" } else { Write-Host "Scheduled task '$taskName' not found." }

foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    if (-not (Test-SafeInstallRoot -Path $root)) { Write-Warning "Refusing to remove $root"; continue }
    if ((Split-Path -Leaf $root) -ieq "ATACSAgent") {
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
    else {
        # Custom -InstallRoot: remove only the agent's files, and the folder when it is then empty.
        Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -eq "atacs-agent.ps1" -or $_.Name -eq "atacs-agent.ps1.bak" -or $_.Name -eq "update.log" -or $_.Name -like "atacs-agent.ps1.download-*"
        } | Remove-Item -Force -ErrorAction SilentlyContinue
        if (-not (Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue)) { Remove-Item -LiteralPath $root -Force -ErrorAction SilentlyContinue }
    }
    if (Test-Path -LiteralPath $root) { Write-Warning "Kept $root (in use or not empty)" } else { Write-Host "Removed folder: $root" }
}

Write-Host "ATACS agent uninstall completed."
