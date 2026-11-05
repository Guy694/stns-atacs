param(
    [string]$ApiBaseUrl,
    [string]$EnrollmentToken,
    [int]$FacilityId,
    [int]$WorkGroupId,
    [string]$WorkGroupName,
    [string]$InstallKey,
    [string]$ConfigPath = "$env:ProgramData\ATACSAgent\agent-config.json",
    [switch]$RunOnce,
    [switch]$EnrollOnly
)

$ErrorActionPreference = "Stop"
$script:AgentVersion = "2.1.0"

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

function Test-ApiBaseAllowed {
    # SEC-06: follow a server-announced address only over https and only for allow-listed hosts
    # (or the host the agent already reports to). Prevents a stolen old deployment from
    # redirecting every agent to an attacker-controlled server.
    param([string]$NewBase, [string]$CurrentBase)

    $allowedSuffixes = @('.moph.go.th')
    try { $newUri = [Uri]$NewBase } catch { return $false }
    if ($newUri.Scheme -ne 'https') { return $false }
    $targetHost = $newUri.Host.ToLowerInvariant()

    $currentHost = ''
    if ($CurrentBase) { try { $currentHost = ([Uri]$CurrentBase).Host.ToLowerInvariant() } catch { $currentHost = '' } }
    if ($currentHost -and $targetHost -eq $currentHost) { return $true }

    foreach ($suffix in $allowedSuffixes) {
        if ($targetHost -eq $suffix.TrimStart('.') -or $targetHost.EndsWith($suffix)) { return $true }
    }
    return $false
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

function Test-IsElevated {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    catch { return $false }
}

function Protect-ConfigDirectory {
    # SEC-18: agent-config.json มี agent key ให้อ่านได้เฉพาะ SYSTEM และ Administrators
    # ใช้ SID แทนชื่อกลุ่ม เพราะ Windows ภาษาไทยชื่อกลุ่มไม่ตรงกับภาษาอังกฤษ
    param([string]$Path)
    if (-not (Test-IsElevated)) { return }
    $dir = Split-Path -Parent $Path
    try {
        & icacls.exe $dir /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T /C /Q | Out-Null
    }
    catch {
        Write-Warning "Unable to restrict permissions on $dir"
    }
}

function Save-Config {
    param([string]$Path, [hashtable]$Config)
    Ensure-Directory -Path $Path
    $Config | ConvertTo-Json -Depth 5 | Set-Content -Path $Path -Encoding UTF8
    Protect-ConfigDirectory -Path $Path
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

function Invoke-Safe {
    # เก็บข้อมูลแต่ละส่วนแยกกัน ส่วนใดอ่านไม่ได้ (สิทธิ์ไม่พอ / Windows รุ่นเก่า) ให้ข้ามไป ไม่ล้มทั้งรายงาน
    param([scriptblock]$Block, $Default = $null)
    try { return & $Block }
    catch { return $Default }
}

function Get-CleanSerial {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $text = $Value.Trim()
    $junk = '^(to be filled.*|default string|system serial number|chassis serial number|base ?board serial number|serial ?number|not specified|not applicable|not available|none|null|n/?a|unknown|invalid|o\.?e\.?m\.?|oem|123456789|1234567890|0123456789|[0x.\- _]+|f{8,}|[*#?]+)$'
    if ($text.Length -lt 3 -or $text -match $junk) { return $null }
    return $text
}

function Get-PrimaryAdapter {
    # เลือกการ์ดเครือข่ายที่มี default gateway และไม่ใช่การ์ดเสมือน (VPN, Hyper-V, VirtualBox, VMware)
    $configs = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = TRUE" |
        Where-Object { $_.IPAddress -and $_.MACAddress })
    $virtual = 'virtual|hyper-v|vmware|virtualbox|vpn|tap-|tunnel|loopback|bluetooth|wan miniport|fortinet|cisco anyconnect|zerotier|tailscale'
    $physical = @($configs | Where-Object { $_.Description -notmatch $virtual })
    foreach ($candidates in @(
        @($physical | Where-Object { $_.DefaultIPGateway }),
        $physical,
        @($configs | Where-Object { $_.DefaultIPGateway }),
        $configs
    )) {
        if ($candidates.Count -gt 0) { return $candidates[0] }
    }
    return $null
}

function Get-AdapterIPv4 {
    param($Adapter)
    if (-not $Adapter) { return $null }
    return @($Adapter.IPAddress | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notlike '169.254.*' -and $_ -notlike '127.*' }) | Select-Object -First 1
}

function Get-DeviceType {
    try {
        $system = Get-CimInstance Win32_ComputerSystem
        switch ($system.PCSystemType) {
            2 { return "Laptop" }
            3 { return "Workstation" }
            4 { return "Enterprise Server" }
            5 { return "Server" }
            8 { return "Tablet" }
            default { return "Desktop" }
        }
    }
    catch {
        return "Computer"
    }
}

function Test-JunkUuid {
    # UUID ที่ผู้ผลิตเมนบอร์ดราคาถูกใส่เหมือนกันทุกเครื่อง: เลขเดียวกันทั้งหมด หรือค่าตัวอย่างของ AMI BIOS
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
    $text = $Value.Trim().ToUpperInvariant()
    if ($text -eq '03000200-0400-0500-0006-000700080009') { return $true }
    $digits = $text.Replace('-', '')
    return (@($digits.ToCharArray() | Select-Object -Unique).Count -le 1)
}

function Get-Fingerprint {
    # ใช้ UUID ของเครื่องเป็นหลัก ไม่ใช้ MAC (เปลี่ยนได้เมื่อเสียบ USB LAN / VPN / Wi-Fi ทำให้เกิดเครื่องซ้ำ)
    $uuid = Invoke-Safe { (Get-CimInstance Win32_ComputerSystemProduct).UUID }
    $uuidIsJunk = Test-JunkUuid $uuid
    # คงสูตรเดิมไว้: UUID ศูนย์ล้วน/F ล้วนถูกตัดทิ้งตั้งแต่รุ่น 2.0 (fingerprint เดิมของเครื่องที่ใช้อยู่ไม่เปลี่ยน)
    if ($uuid -match '^(0{8}-0{4}-0{4}-0{4}-0{12}|F{8}-F{4}-F{4}-F{4}-F{12})$') { $uuid = $null }
    $bios = Get-CleanSerial (Invoke-Safe { (Get-CimInstance Win32_BIOS).SerialNumber })
    $board = Get-CleanSerial (Invoke-Safe { (Get-CimInstance Win32_BaseBoard).SerialNumber })
    # S4: UUID ขยะ (เช่น 03000200-0400-0500-0006-000700080009) + ไม่มี serial = ทุกเครื่องรุ่นนั้นได้ fingerprint เดียวกัน
    # จึงใช้ MAC + ชื่อเครื่องแทนเฉพาะกรณีนี้ เครื่องที่มี UUID/serial ดีได้ fingerprint เดิมทุกประการ
    if (($uuidIsJunk -or -not $uuid) -and -not $bios -and -not $board) {
        $adapter = Get-PrimaryAdapter
        return Get-Sha256 -Text "mac|$($adapter.MACAddress)|$env:COMPUTERNAME"
    }
    return Get-Sha256 -Text "v2|$uuid|$bios|$board"
}

function Get-Volumes {
    $systemDrive = $env:SystemDrive
    return @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Where-Object { $_.Size -gt 0 } | ForEach-Object {
        @{
            mount = $_.DeviceID
            label = $_.VolumeName
            fileSystem = $_.FileSystem
            totalGb = [math]::Round($_.Size / 1GB, 2)
            freeGb = [math]::Round($_.FreeSpace / 1GB, 2)
            isSystem = ($_.DeviceID -eq $systemDrive)
        }
    })
}

function Get-PhysicalDisks {
    $disks = @(Invoke-Safe {
        Get-PhysicalDisk | ForEach-Object {
            @{
                model = $_.FriendlyName
                mediaType = [string]$_.MediaType
                sizeGb = [math]::Round($_.Size / 1GB)
                healthStatus = [string]$_.HealthStatus
                predictFailure = $null
            }
        }
    } @())
    # SMART ของไดรฟ์ (ต้องมีสิทธิ์ผู้ดูแล) ถ้ามีไดรฟ์ใดคาดว่าจะเสีย ให้แจ้งเพิ่ม
    $failing = @(Invoke-Safe { Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus | Where-Object { $_.PredictFailure } } @())
    foreach ($item in $failing) {
        $disks += @{ model = [string]$item.InstanceName; mediaType = $null; sizeGb = $null; healthStatus = "Predict failure"; predictFailure = $true }
    }
    return $disks
}

function Get-WindowsActivation {
    # S2: เครื่องหนึ่งอาจมีหลาย product (เช่น คีย์ OEM เดิม + คีย์ที่ activate จริง) เลือกตัวที่ Licensed ก่อน
    # (เดิม Sort-Object LicenseStatus เลือก 0 = Unlicensed ก่อน ทำให้เครื่องแท้ถูกรายงานว่าไม่ได้ activate)
    $products = @(Invoke-Safe {
        Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL"
    } @())
    $product = $products | Where-Object { $_.LicenseStatus -eq 1 } | Select-Object -First 1
    if (-not $product) { $product = $products | Where-Object { $_.LicenseStatus -ne 0 } | Select-Object -First 1 }
    if (-not $product) { $product = $products | Select-Object -First 1 }
    if (-not $product) { return $null }
    switch ([int]$product.LicenseStatus) {
        0 { return "Unlicensed" }
        1 { return "Licensed" }
        2 { return "OOBGrace" }
        3 { return "OOTGrace" }
        4 { return "NonGenuineGrace" }
        5 { return "Notification" }
        6 { return "ExtendedGrace" }
        default { return "Unknown" }
    }
}

function Get-Antivirus {
    # Windows Security Center มีเฉพาะ Windows รุ่นเครื่องลูกข่าย (ไม่มีบน Windows Server)
    return @(Invoke-Safe {
        Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object {
            $state = [int]$_.productState
            @{
                name = $_.displayName
                enabled = ((($state -shr 12) -band 0xF) -eq 1)
                upToDate = ((($state -shr 4) -band 0xF) -eq 0)
            }
        }
    } @())
}

function Get-LastUpdateInstalledAt {
    $dates = @(Invoke-Safe {
        Get-CimInstance Win32_QuickFixEngineering | ForEach-Object {
            if ($_.InstalledOn) { [datetime]$_.InstalledOn }
        }
    } @())
    if ($dates.Count -eq 0) { return $null }
    return ($dates | Sort-Object -Descending | Select-Object -First 1).ToUniversalTime().ToString("o")
}

function Test-PendingReboot {
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
    )
    foreach ($key in $keys) { if (Test-Path $key) { return $true } }
    return $false
}

function Get-BatteryHealthPercent {
    $full = Invoke-Safe { (Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1).FullChargedCapacity }
    $design = Invoke-Safe { (Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData | Select-Object -First 1).DesignedCapacity }
    if (-not $full -or -not $design) { return $null }
    return [math]::Round(($full / $design) * 100)
}

function Get-InventoryPayload {
    $cs = Get-CimInstance Win32_ComputerSystem
    $bios = Get-CimInstance Win32_BIOS
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $adapter = Get-PrimaryAdapter
    # @() กันกรณีมีรายการเดียว PowerShell จะคืนค่าเดี่ยวแทน array ทำให้ JSON ผิดรูป
    $volumes = @(Get-Volumes)
    $diskBytes = (@($volumes) | ForEach-Object { $_.totalGb } | Measure-Object -Sum).Sum
    $diskFree = (@($volumes) | ForEach-Object { $_.freeGb } | Measure-Object -Sum).Sum

    # RAM ที่ติดตั้งจริง (TotalPhysicalMemory หักส่วนที่การ์ดจอใช้ไปแล้ว จึงน้อยกว่าความจริง)
    $installedRam = Invoke-Safe { (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum }
    if (-not $installedRam) { $installedRam = $cs.TotalPhysicalMemory }
    $ramMb = [int][math]::Round($installedRam / 1MB)

    $serial = Get-CleanSerial $bios.SerialNumber
    if (-not $serial) { $serial = Get-CleanSerial (Invoke-Safe { (Get-CimInstance Win32_ComputerSystemProduct).IdentifyingNumber }) }
    $osName = $os.Caption
    if ($osName) { $osName = $osName.Replace("Microsoft ", "").Trim() }

    $health = @{
        volumes = $volumes
        memoryTotalMb = $ramMb
        memoryAvailableMb = Invoke-Safe { [int][math]::Round($os.FreePhysicalMemory / 1KB) }
        cpuLoadPercent = Invoke-Safe { [int](Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average }
        lastBootAt = Invoke-Safe { $os.LastBootUpTime.ToUniversalTime().ToString("o") }
        physicalDisks = @(Get-PhysicalDisks)
        windowsActivation = Get-WindowsActivation
        antivirus = @(Get-Antivirus)
        lastUpdateInstalledAt = Get-LastUpdateInstalledAt
        pendingReboot = Invoke-Safe { Test-PendingReboot } $null
        batteryHealthPercent = Get-BatteryHealthPercent
    }

    return @{
        fingerprint = Get-Fingerprint
        hostname = $env:COMPUTERNAME
        serialNumber = $serial
        biosSerial = Get-CleanSerial $bios.SerialNumber
        deviceType = Get-DeviceType
        manufacturerBrand = $cs.Manufacturer
        manufacturerModel = $cs.Model
        operatingSystem = $osName
        operatingSystemVersion = $os.Version
        privateIp = Get-AdapterIPv4 -Adapter $adapter
        macAddress = if ($adapter) { $adapter.MACAddress } else { $null }
        currentUser = $cs.UserName
        cpuModel = if ($cpu.Name) { $cpu.Name.Trim() } else { $null }
        ramMb = $ramMb
        diskTotalGb = if ($null -ne $diskBytes) { [int][math]::Round($diskBytes) } else { $null }
        diskFreeGb = if ($null -ne $diskFree) { [int][math]::Round($diskFree) } else { $null }
        diskUsedGb = if ($null -ne $diskBytes -and $null -ne $diskFree) { [int][math]::Round($diskBytes - $diskFree) } else { $null }
        locationDetail = $env:COMPUTERNAME
        agentVersion = $script:AgentVersion
        status = "online"
        collectedAt = (Get-Date).ToUniversalTime().ToString("o")
        health = $health
    }
}

function Invoke-JsonPost {
    param(
        [string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers
    )

    $json = $Body | ConvertTo-Json -Depth 8
    # S1: PowerShell 5.1 ส่ง body แบบ string เป็น ISO-8859-1 ทำให้ชื่อเครื่อง/ผู้ใช้ภาษาไทยเพี้ยน ส่งเป็น UTF-8 bytes เอง
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    try {
        return Invoke-RestMethod -Method Post -Uri $Url -ContentType "application/json; charset=utf-8" -Headers $Headers -Body $bytes -TimeoutSec 30 -UseBasicParsing
    }
    catch {
        # G4: แสดงข้อความ error จากเซิร์ฟเวอร์ (เดิม throw ใน try ถูก catch ของตัวเองกลืนไป)
        $requestError = $_
        $statusCode = 0
        $rawBody = $null
        $errorResponse = $requestError.Exception.Response
        if ($errorResponse) {
            try { $statusCode = [int]$errorResponse.StatusCode } catch { $statusCode = 0 }
        }
        if ($requestError.ErrorDetails -and $requestError.ErrorDetails.Message) {
            $rawBody = $requestError.ErrorDetails.Message
        }
        elseif ($errorResponse) {
            try {
                $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
                $rawBody = $reader.ReadToEnd()
            }
            catch {
                $rawBody = $null
            }
        }
        $message = if ($rawBody) { "HTTP $statusCode from $Url : $rawBody" } else { "Request to $Url failed: $($requestError.Exception.Message)" }
        $failure = New-Object System.Exception($message, $requestError.Exception)
        $failure.Data["StatusCode"] = $statusCode
        throw $failure
    }
}

function Enroll-Agent {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [int]$FacilityId,
        [int]$WorkGroupId,
        [string]$WorkGroupName,
        [string]$InstallKey,
        [string]$Path
    )

    $normalizedBaseUrl = Normalize-ApiBaseUrl -BaseUrl $BaseUrl
    if (-not $normalizedBaseUrl) { throw "ApiBaseUrl is required for enrollment." }
    $hasToken = -not [string]::IsNullOrWhiteSpace($Token)
    $hasStaticInstall = -not [string]::IsNullOrWhiteSpace($InstallKey) -and $FacilityId -gt 0
    if (-not $hasToken -and -not $hasStaticInstall) {
        throw "EnrollmentToken or InstallKey + FacilityId is required for enrollment."
    }

    $payload = Get-InventoryPayload
    $body = @{
        fingerprint = $payload.fingerprint
        hostname = $payload.hostname
        agentVersion = $payload.agentVersion
    }
    if ($hasToken) {
        $body.enrollmentToken = $Token
    }
    else {
        $body.installKey = $InstallKey
        $body.facilityId = $FacilityId
        if ($WorkGroupId -gt 0) {
            $body.workGroupId = $WorkGroupId
        }
        elseif (-not [string]::IsNullOrWhiteSpace($WorkGroupName)) {
            $body.workGroupName = $WorkGroupName
        }
    }
    $response = Invoke-JsonPost -Url "$normalizedBaseUrl/api/agent/enroll/" -Body $body -Headers @{}

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

    return Invoke-JsonPost -Url "$($Config.apiBaseUrl.TrimEnd('/'))/api/agent/report/" -Body $Payload -Headers $headers
}

try {
    Enable-TlsForLegacyPowerShell

    $config = Get-Config -Path $ConfigPath
    $hasToken = -not [string]::IsNullOrWhiteSpace($EnrollmentToken)
    $hasStaticInstall = -not [string]::IsNullOrWhiteSpace($InstallKey) -and $FacilityId -gt 0
    $forceEnroll = -not [string]::IsNullOrWhiteSpace($ApiBaseUrl) -and ($hasToken -or $hasStaticInstall)

    # ติดตั้งทับรุ่นเดิม (เซิร์ฟเวอร์เดิม): ลองส่งรายงานด้วยกุญแจเดิมก่อน ถ้าผ่านไม่ต้องลงทะเบียนใหม่
    # กันการเกิดเครื่องซ้ำเพราะสูตร fingerprint ของรุ่น 2.0 ต่างจากรุ่นก่อน
    if ($config -and $forceEnroll -and $config.agentId -and $config.agentKey -and
        (Normalize-ApiBaseUrl -BaseUrl ([string]$config.apiBaseUrl)) -eq (Normalize-ApiBaseUrl -BaseUrl $ApiBaseUrl)) {
        try {
            $upgradeResult = Send-Inventory -Config $config -Payload (Get-InventoryPayload)
            Write-Host "Existing enrollment is still valid (DeviceId=$($upgradeResult.deviceId)); keeping it."
            $forceEnroll = $false
        }
        catch {
            $status = 0
            if ($_.Exception.Data -and $_.Exception.Data.Contains("StatusCode")) { $status = [int]$_.Exception.Data["StatusCode"] }
            if ($status -gt 0 -and $status -ne 401) {
                # เช่น 409 ทะเบียนที่ผูกไว้ใช้ไม่ได้: กุญแจยังใช้ได้ ไม่ต้องลงทะเบียนใหม่
                Write-Warning "Existing enrollment is valid but the report failed: $($_.Exception.Message)"
                $forceEnroll = $false
            }
            else {
                Write-Host "Existing enrollment was rejected ($($_.Exception.Message)); enrolling again."
            }
        }
    }

    if (-not $config -or $forceEnroll) {
        $config = Enroll-Agent -BaseUrl $ApiBaseUrl -Token $EnrollmentToken -FacilityId $FacilityId -WorkGroupId $WorkGroupId -WorkGroupName $WorkGroupName -InstallKey $InstallKey -Path $ConfigPath
        Write-Host "Enrolled device for facility: $($config.facilityName)"
    }

    if ($EnrollOnly) {
        Write-Host "Enrollment completed. Config saved to $ConfigPath"
        exit 0
    }

    $payload = Get-InventoryPayload
    $result = Send-Inventory -Config $config -Payload $payload
    Write-Host "Inventory report sent successfully. DeviceId=$($result.deviceId) AssetId=$($result.linkedAssetId)"

    # The server announces its current address after a move (e.g. Vercel -> own server); follow it once.
    if ($result -and $result.apiBaseUrl) {
        $newBase = Normalize-ApiBaseUrl -BaseUrl ([string]$result.apiBaseUrl)
        $currentBase = Normalize-ApiBaseUrl -BaseUrl ([string]$config.apiBaseUrl)
        if ($newBase -ne $currentBase -and -not (Test-ApiBaseAllowed -NewBase $newBase -CurrentBase $currentBase)) {
            Write-Warning "Refused server address change to $newBase (host not allowed). Still reporting to $currentBase."
        }
        elseif ($newBase -ne $currentBase) {
            if ($config -is [hashtable]) {
                $updated = $config.Clone()
            }
            else {
                $updated = @{}
                foreach ($property in $config.PSObject.Properties) { $updated[$property.Name] = $property.Value }
            }
            $updated["apiBaseUrl"] = $newBase
            Save-Config -Path $ConfigPath -Config $updated
            Write-Host "Server address changed; apiBaseUrl updated to $newBase"
        }
    }
}
catch {
    Write-Error $_
    exit 1
}

if ($RunOnce) {
    exit 0
}
