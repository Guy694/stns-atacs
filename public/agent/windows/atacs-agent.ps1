param(
    [string]$ApiBaseUrl,
    [string]$EnrollmentToken,
    [string]$ConfigPath = "$env:ProgramData\ATACSAgent\agent-config.json",
    [switch]$RunOnce,
    [switch]$EnrollOnly
)

$ErrorActionPreference = "Stop"
$script:AgentVersion = "1.0.0"

function Enable-TlsForLegacyPowerShell {
    try {
        # PowerShell 5.1 may default to TLS 1.0/1.1 on some machines.
        $tls12 = [Net.SecurityProtocolType]::Tls12
        if ([Enum]::GetNames([Net.SecurityProtocolType]) -contains "Tls13") {
            $tls13 = [Net.SecurityProtocolType]::Tls13
            [Net.ServicePointManager]::SecurityProtocol = $tls12 -bor $tls13
            return
        }
        [Net.ServicePointManager]::SecurityProtocol = $tls12
    }
    catch {
        # Ignore when running on environments that do not expose these flags.
    }
}

function Normalize-ApiBaseUrl {
    param([string]$BaseUrl)
    if (-not $BaseUrl) { return $null }
    return $BaseUrl.Trim().TrimEnd('/')
}

function Ensure-Directory {
    param([string]$Path)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Get-Config {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return Get-Content -Path $Path -Raw | ConvertFrom-Json
}

function Save-Config {
    param([string]$Path, [hashtable]$Config)
    Ensure-Directory -Path $Path
    $Config | ConvertTo-Json -Depth 5 | Set-Content -Path $Path -Encoding UTF8
}

function Get-Sha256 {
    param([string]$Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-PreferredIPv4 {
    $addresses = Get-CimInstance Win32_NetworkAdapterConfiguration |
        Where-Object { $_.IPEnabled -and $_.IPAddress } |
        ForEach-Object { $_.IPAddress } |
        ForEach-Object { $_ } |
        Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notlike '169.254.*' }

    return ($addresses | Select-Object -First 1)
}

function Get-PreferredMac {
    $macs = Get-CimInstance Win32_NetworkAdapterConfiguration |
        Where-Object { $_.IPEnabled -and $_.MACAddress } |
        Select-Object -ExpandProperty MACAddress

    return ($macs | Select-Object -First 1)
}

function Get-DeviceType {
    try {
        $system = Get-CimInstance Win32_ComputerSystem
        switch ($system.PCSystemType) {
            2 { return "Laptop" }
            3 { return "Workstation" }
            4 { return "Enterprise Server" }
            8 { return "Tablet" }
            default { return "Desktop" }
        }
    }
    catch {
        return "Computer"
    }
}

function Get-Fingerprint {
    $bios = (Get-CimInstance Win32_BIOS).SerialNumber
    $product = (Get-CimInstance Win32_ComputerSystemProduct).UUID
    $board = (Get-CimInstance Win32_BaseBoard).SerialNumber
    $mac = Get-PreferredMac
    return Get-Sha256 -Text "$bios|$product|$board|$mac"
}

function Get-InventoryPayload {
    $cs = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $diskBytes = (Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Measure-Object -Property Size -Sum).Sum

    return @{
        fingerprint = Get-Fingerprint
        hostname = $env:COMPUTERNAME
        serialNumber = $bios.SerialNumber
        biosSerial = $bios.SerialNumber
        deviceType = Get-DeviceType
        manufacturerBrand = $cs.Manufacturer
        manufacturerModel = $cs.Model
        operatingSystem = $os.Caption
        operatingSystemVersion = $os.Version
        privateIp = Get-PreferredIPv4
        macAddress = Get-PreferredMac
        currentUser = $cs.UserName
        cpuModel = $cpu.Name
        ramMb = [int][math]::Round($cs.TotalPhysicalMemory / 1MB)
        diskTotalGb = if ($diskBytes) { [int][math]::Round($diskBytes / 1GB) } else { $null }
        locationDetail = $env:COMPUTERNAME
        agentVersion = $script:AgentVersion
        status = "online"
        collectedAt = (Get-Date).ToString("s")
    }
}

function Invoke-JsonPost {
    param(
        [string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers
    )

    $json = $Body | ConvertTo-Json -Depth 8
    try {
        return Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json" -Headers $Headers -Body $json -TimeoutSec 30
    }
    catch {
        $errorResponse = $_.Exception.Response
        if ($errorResponse -and $errorResponse.GetResponseStream) {
            try {
                $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
                $rawBody = $reader.ReadToEnd()
                if ($rawBody) {
                    throw "HTTP request failed: $rawBody"
                }
            }
            catch {
                # Fall through to original error below.
            }
        }
        throw
    }
}

function Enroll-Agent {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [string]$Path
    )

    $normalizedBaseUrl = Normalize-ApiBaseUrl -BaseUrl $BaseUrl
    if (-not $normalizedBaseUrl) { throw "ApiBaseUrl is required for enrollment." }
    if (-not $Token) { throw "EnrollmentToken is required for enrollment." }

    $payload = Get-InventoryPayload
    $response = Invoke-JsonPost -Url "$normalizedBaseUrl/api/agent/enroll" -Body @{
        enrollmentToken = $Token
        fingerprint = $payload.fingerprint
        hostname = $payload.hostname
        agentVersion = $payload.agentVersion
    } -Headers @{}

    $config = @{
        apiBaseUrl = $normalizedBaseUrl
        facilityId = $response.facilityId
        facilityName = $response.facilityName
        agentId = $response.agentId
        agentKey = $response.agentKey
        deviceId = $response.deviceId
        enrolledAt = (Get-Date).ToString("s")
    }
    Save-Config -Path $Path -Config $config
    return $config
}

function Send-Inventory {
    param(
        [pscustomobject]$Config,
        [hashtable]$Payload
    )

    $headers = @{
        "x-agent-id" = $Config.agentId
        "x-agent-key" = $Config.agentKey
    }

    return Invoke-JsonPost -Url "$($Config.apiBaseUrl.TrimEnd('/'))/api/agent/report" -Body $Payload -Headers $headers
}

try {
    Enable-TlsForLegacyPowerShell

    $config = Get-Config -Path $ConfigPath
    $forceEnroll = -not [string]::IsNullOrWhiteSpace($ApiBaseUrl) -and -not [string]::IsNullOrWhiteSpace($EnrollmentToken)
    if (-not $config -or $forceEnroll) {
        $config = Enroll-Agent -BaseUrl $ApiBaseUrl -Token $EnrollmentToken -Path $ConfigPath
        Write-Host "Enrolled device for facility: $($config.facilityName)"
    }

    if ($EnrollOnly) {
        Write-Host "Enrollment completed. Config saved to $ConfigPath"
        exit 0
    }

    $payload = Get-InventoryPayload
    $result = Send-Inventory -Config $config -Payload $payload
    Write-Host "Inventory report sent successfully. DeviceId=$($result.deviceId) AssetId=$($result.linkedAssetId)"
}
catch {
    Write-Error $_
    exit 1
}

if ($RunOnce) {
    exit 0
}
