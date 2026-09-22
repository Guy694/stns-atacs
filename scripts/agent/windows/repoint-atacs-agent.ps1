# Moves an installed ATACS Agent to a new server address without re-enrolling.
# Keeps the device identity (agentId/agentKey), updates apiBaseUrl, installs the current agent script
# (which follows future server moves on its own) and sends one report to confirm.
# Run as Administrator:
#   $b='https://atacs.example.go.th'; iwr "$b/agent/windows/repoint-atacs-agent.ps1" -OutFile "$env:TEMP\repoint-atacs-agent.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\repoint-atacs-agent.ps1" -ApiBaseUrl $b
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = $ApiBaseUrl.Trim().TrimEnd('/')
if ($base -notmatch '^https?://') { throw "ApiBaseUrl must start with http:// or https://" }

$roots = @("$env:ProgramData\ATACSAgent", "$env:LOCALAPPDATA\ATACSAgent") | Where-Object { Test-Path (Join-Path $_ "agent-config.json") }
if (-not $roots) { throw "ATACS Agent config (agent-config.json) not found. Use the install command from the Agent download page instead." }

foreach ($root in $roots) {
    $configPath = Join-Path $root "agent-config.json"
    $config = Get-Content -Path $configPath -Raw | ConvertFrom-Json
    $old = $config.apiBaseUrl
    $updated = @{}
    foreach ($property in $config.PSObject.Properties) { $updated[$property.Name] = $property.Value }
    $updated["apiBaseUrl"] = $base
    Copy-Item $configPath "$configPath.bak" -Force
    $updated | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding UTF8

    $script = Join-Path $root "atacs-agent.ps1"
    Invoke-WebRequest "$base/agent/windows/atacs-agent.ps1" -OutFile $script -UseBasicParsing
    Write-Host "[$root] apiBaseUrl: $old -> $base"

    powershell.exe -ExecutionPolicy Bypass -File $script -ConfigPath $configPath -RunOnce
    if ($LASTEXITCODE -ne 0) { Write-Warning "Report failed. Check the connection to $base (previous config saved as $configPath.bak)" }
}
