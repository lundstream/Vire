<#
.SYNOPSIS
    Server Inventory Collection Script
    Collects comprehensive server inventory data and POSTs to the Inventory Web API.
    Designed to run as a Scheduled Task under the SYSTEM account (read-only operations).

.DESCRIPTION
    Gathers: OS info, hardware, network, disks, patches, services, roles, security status,
    firewall rules, AD GPOs, local policies, event logs, and more.
    All operations are read-only.

.PARAMETER ApiUrl
    The Inventory Web API endpoint (e.g., https://inventory.contoso.com/api/inventory)

.PARAMETER ApiKey
    The API key for authentication

.EXAMPLE
    .\Collect-ServerInventory.ps1 -ApiUrl "https://inventory.contoso.com/api/inventory" -ApiKey "abc123..."

.NOTES
    Run as: SYSTEM (Scheduled Task)
    Permissions: Read-only
    Frequency: Every 4-6 hours recommended
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey
)

$ErrorActionPreference = 'SilentlyContinue'

# ============================================================================
#  HELPER FUNCTIONS
# ============================================================================
function Get-SafeValue {
    param([scriptblock]$ScriptBlock, $Default = $null)
    try { $result = & $ScriptBlock; if ($null -ne $result) { return $result } else { return $Default } }
    catch { return $Default }
}

# ============================================================================
#  SYSTEM INFORMATION
# ============================================================================
Write-Host "Collecting system information..." -ForegroundColor Cyan

$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS

$hostname = $env:COMPUTERNAME
$fqdn = Get-SafeValue { [System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).HostName } $hostname

# Domain or Workgroup
$domainType = if ($cs.PartOfDomain) { "Domain" } else { "Workgroup" }
$domainOrWorkgroup = if ($cs.PartOfDomain) { $cs.Domain } else { $cs.Workgroup }

# OU (if domain-joined)
$ou = Get-SafeValue {
    if ($cs.PartOfDomain) {
        $searcher = [adsisearcher]"(&(objectCategory=computer)(cn=$hostname))"
        $result = $searcher.FindOne()
        if ($result) {
            $dn = $result.Properties["distinguishedname"][0]
            ($dn -split ',', 2)[1]
        }
    }
}

# OS info
$osEdition = $os.Caption
$osVersion = $os.Version
$osBuild = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue).DisplayVersion
if (-not $osBuild) { $osBuild = $os.BuildNumber }
$installDate = Get-SafeValue { $os.InstallDate.ToString('o') }
$lastBoot = Get-SafeValue { $os.LastBootUpTime.ToString('o') }

# Activation status
$activationStatus = Get-SafeValue {
    $slmgr = Get-CimInstance SoftwareLicensingProduct | Where-Object { $_.PartialProductKey -and $_.LicenseStatus -eq 1 } | Select-Object -First 1
    if ($slmgr) { "Activated" } else { "Not Activated" }
} "Unknown"

# Physical vs VM
$isVirtual = $false
$hypervisor = $null
$model = $cs.Model
$manufacturer = $cs.Manufacturer

if ($model -match 'Virtual|VMware|VirtualBox|Xen|KVM|HVM|BHYVE') { $isVirtual = $true }
if ($manufacturer -match 'Microsoft Corporation' -and $model -match 'Virtual') {
    $isVirtual = $true; $hypervisor = 'Microsoft Hyper-V'
}
elseif ($model -match 'VMware') { $isVirtual = $true; $hypervisor = 'VMware ESXi' }
elseif ($model -match 'VirtualBox') { $isVirtual = $true; $hypervisor = 'Oracle VirtualBox' }
elseif ($model -match 'KVM|QEMU') { $isVirtual = $true; $hypervisor = 'KVM/QEMU' }
elseif ($model -match 'Xen') { $isVirtual = $true; $hypervisor = 'Xen' }
elseif ($bios.SerialNumber -match 'VMware') { $isVirtual = $true; $hypervisor = 'VMware ESXi' }

# ============================================================================
#  CPU & RAM
# ============================================================================
Write-Host "Collecting CPU & RAM..." -ForegroundColor Cyan

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cpuModel = $cpu.Name
$cpuCores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum
$cpuUsage = Get-SafeValue { [math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average, 1) } 0

$ramTotalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$ramFreeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
$ramUsedGB = [math]::Round($ramTotalGB - $ramFreeGB, 2)

# ============================================================================
#  DISK LAYOUT
# ============================================================================
Write-Host "Collecting disk information..." -ForegroundColor Cyan

$disks = @()
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
    $disks += @{
        drive_letter  = $_.DeviceID
        volume_label  = $_.VolumeName
        size_gb       = [math]::Round($_.Size / 1GB, 2)
        free_gb       = [math]::Round($_.FreeSpace / 1GB, 2)
        file_system   = $_.FileSystem
    }
}

# ============================================================================
#  NETWORK ADAPTERS & IP ADDRESSES
# ============================================================================
Write-Host "Collecting network information..." -ForegroundColor Cyan

$ipAddresses = @()
Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | ForEach-Object {
    $adapter = Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.Index -eq $_.Index } | Select-Object -First 1
    $ips = $_.IPAddress
    $masks = $_.IPSubnet
    if ($ips) {
        for ($i = 0; $i -lt $ips.Count; $i++) {
            $ipAddresses += @{
                adapter_name = $_.Description
                ip_address   = $ips[$i]
                subnet_mask  = if ($masks -and $i -lt $masks.Count) { $masks[$i] } else { $null }
                mac_address  = $_.MACAddress
                speed_mbps   = Get-SafeValue { [math]::Round(($adapter.Speed / 1MB), 0) }
            }
        }
    }
}

# ============================================================================
#  PATCHES & UPDATES
# ============================================================================
Write-Host "Collecting patch information..." -ForegroundColor Cyan

$lastPatchDate = Get-SafeValue {
    $hotfixes = Get-HotFix | Sort-Object InstalledOn -Descending
    if ($hotfixes.Count -gt 0 -and $hotfixes[0].InstalledOn) {
        $hotfixes[0].InstalledOn.ToString('o')
    }
}

# Missing updates (requires Windows Update Agent)
$missingUpdates = @()
$missingCriticalCount = 0
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $result = $searcher.Search("IsInstalled=0 AND Type='Software'")
    foreach ($update in $result.Updates) {
        $severity = "Unknown"
        if ($update.MsrcSeverity) { $severity = $update.MsrcSeverity }
        elseif ($update.AutoSelectOnWebSites) { $severity = "Important" }

        $kbNumbers = @()
        foreach ($kb in $update.KBArticleIDs) { $kbNumbers += "KB$kb" }

        $missingUpdates += @{
            kb_id    = ($kbNumbers -join ', ')
            title    = $update.Title
            severity = $severity
        }
        if ($severity -eq 'Critical') { $missingCriticalCount++ }
    }
} catch {
    Write-Warning "Could not query Windows Update: $_"
}

# WSUS Server
$wsusServer = Get-SafeValue {
    (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' -ErrorAction SilentlyContinue).WUServer
}

# Reboot pending
$rebootPending = $false
$rbKeys = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired',
    'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations'
)
foreach ($key in $rbKeys) {
    if (Test-Path $key) { $rebootPending = $true; break }
}

# ============================================================================
#  INSTALLED ROLES & FEATURES
# ============================================================================
Write-Host "Collecting roles & features..." -ForegroundColor Cyan

$roles = @()
try {
    # Windows Server
    Get-WindowsFeature | Where-Object { $_.Installed } | ForEach-Object {
        $roles += @{
            name = $_.DisplayName
            type = $_.FeatureType
        }
    }
} catch {
    # Fallback: use registry or DISM
    try {
        Get-WindowsOptionalFeature -Online | Where-Object { $_.State -eq 'Enabled' } | ForEach-Object {
            $roles += @{
                name = $_.FeatureName
                type = 'Feature'
            }
        }
    } catch { }
}

# Also detect SQL Server, IIS, etc. from services
$knownApps = @(
    @{ Pattern = 'MSSQLSERVER|MSSQL\$'; Name = 'Microsoft SQL Server' },
    @{ Pattern = 'W3SVC'; Name = 'Internet Information Services (IIS)' },
    @{ Pattern = 'NTDS'; Name = 'Active Directory Domain Services' },
    @{ Pattern = 'DNS'; Name = 'DNS Server' },
    @{ Pattern = 'DHCPServer'; Name = 'DHCP Server' },
    @{ Pattern = 'CertSvc'; Name = 'Active Directory Certificate Services' }
)
$runningServices = Get-Service -ErrorAction SilentlyContinue
foreach ($app in $knownApps) {
    $svc = $runningServices | Where-Object { $_.Name -match $app.Pattern -and $_.Status -eq 'Running' }
    if ($svc) {
        $alreadyListed = $roles | Where-Object { $_.name -eq $app.Name }
        if (-not $alreadyListed) {
            $roles += @{ name = $app.Name; type = 'Detected Service' }
        }
    }
}

# ============================================================================
#  RUNNING SERVICES (critical only)
# ============================================================================
Write-Host "Collecting critical services..." -ForegroundColor Cyan

$criticalServiceNames = @(
    'wuauserv', 'WinDefend', 'MpsSvc', 'BITS', 'CryptSvc', 'Dnscache',
    'EventLog', 'LanmanServer', 'LanmanWorkstation', 'RpcSs', 'SamSs',
    'Schedule', 'W32Time', 'WinRM', 'TermService', 'Spooler',
    'MSSQLSERVER', 'MSSQL$*', 'W3SVC', 'NTDS', 'DNS', 'DHCPServer',
    'IISADMIN', 'CertSvc', 'DFSR', 'Netlogon', 'gpsvc'
)

$services = @()
foreach ($svcName in $criticalServiceNames) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) {
        $services += @{
            name         = $svc.Name
            display_name = $svc.DisplayName
            status       = $svc.Status.ToString()
            start_type   = $svc.StartType.ToString()
        }
    }
}

# ============================================================================
#  SECURITY: AV / EDR STATUS
# ============================================================================
Write-Host "Collecting security status..." -ForegroundColor Cyan

$avProduct = "Unknown"
$avStatus = "Unknown"

# Try Windows Defender first
try {
    $defender = Get-MpComputerStatus -ErrorAction Stop
    $avProduct = "Microsoft Defender"
    if ($defender.AntivirusEnabled -and $defender.RealTimeProtectionEnabled) {
        $avStatus = "Active"
    } elseif ($defender.AntivirusEnabled) {
        $avStatus = "Enabled (Real-time off)"
    } else {
        $avStatus = "Disabled"
    }
    if ($defender.AntivirusSignatureAge -gt 3) {
        $avStatus += " (Signatures ${($defender.AntivirusSignatureAge)} days old)"
    }
} catch {
    # Try WMI AntiVirusProduct
    try {
        $av = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop | Select-Object -First 1
        if ($av) {
            $avProduct = $av.displayName
            $avStatus = "Installed"
        }
    } catch { }
}

# ============================================================================
#  SECURITY: BITLOCKER
# ============================================================================
$bitlockerStatus = Get-SafeValue {
    $vol = Get-BitLockerVolume -MountPoint "C:" -ErrorAction Stop
    "$($vol.ProtectionStatus) - $($vol.EncryptionMethod)"
} "Not Available"

# ============================================================================
#  SECURITY: LOCAL ADMIN ACCOUNTS
# ============================================================================
$localAdmins = @()
try {
    $admGroup = [ADSI]"WinNT://./Administrators,group"
    $admGroup.Invoke('Members') | ForEach-Object {
        $name = $_.GetType().InvokeMember('Name', 'GetProperty', $null, $_, $null)
        $class = $_.GetType().InvokeMember('Class', 'GetProperty', $null, $_, $null)
        $localAdmins += @{
            account_name = $name
            account_type = $class
        }
    }
} catch {
    try {
        Get-LocalGroupMember -Group "Administrators" -ErrorAction Stop | ForEach-Object {
            $localAdmins += @{
                account_name = $_.Name
                account_type = $_.ObjectClass
            }
        }
    } catch { }
}

# ============================================================================
#  SECURITY: RDP STATUS
# ============================================================================
$rdpEnabled = Get-SafeValue {
    $rdp = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' -ErrorAction Stop
    $rdp.fDenyTSConnections -eq 0
} $false

$nlaEnabled = Get-SafeValue {
    $nla = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -ErrorAction Stop
    $nla.UserAuthentication -eq 1
} $false

# ============================================================================
#  SECURITY: LAST LOGIN
# ============================================================================
$lastAdminLogin = Get-SafeValue {
    $events = Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 50 -ErrorAction Stop
    $adminLogon = $events | Where-Object {
        $xml = [xml]$_.ToXml()
        $logonType = ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'LogonType' }).'#text'
        $targetUser = ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'TargetUserName' }).'#text'
        $logonType -in @('2','10') -and $targetUser -notmatch '^\$|^SYSTEM|^DWM|^UMFD'
    } | Select-Object -First 1
    if ($adminLogon) { $adminLogon.TimeCreated.ToString('o') }
}

$lastUserLogin = Get-SafeValue {
    $events = Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4624; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 100 -ErrorAction Stop
    $userLogon = $events | Where-Object {
        $xml = [xml]$_.ToXml()
        $logonType = ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'LogonType' }).'#text'
        $targetUser = ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'TargetUserName' }).'#text'
        $logonType -eq '2' -and $targetUser -notmatch '^\$|^SYSTEM|^DWM|^UMFD'
    } | Select-Object -First 1
    if ($userLogon) { $userLogon.TimeCreated.ToString('o') }
}

# ============================================================================
#  SECURITY: LAST SECURITY SCAN
# ============================================================================
$lastSecurityScan = Get-SafeValue {
    $defender = Get-MpComputerStatus -ErrorAction Stop
    if ($defender.FullScanEndTime) {
        $defender.FullScanEndTime.ToString('o')
    } elseif ($defender.QuickScanEndTime) {
        $defender.QuickScanEndTime.ToString('o')
    }
}

# ============================================================================
#  EVENT LOG: CRITICAL ERRORS (LAST 24H)
# ============================================================================
Write-Host "Collecting event log errors..." -ForegroundColor Cyan

$eventErrors = @()
$criticalEvents24h = 0
try {
    $startTime = (Get-Date).AddHours(-24)
    $logs = @('System', 'Application')
    foreach ($logName in $logs) {
        $events = Get-WinEvent -FilterHashtable @{LogName=$logName; Level=1; StartTime=$startTime} -MaxEvents 20 -ErrorAction SilentlyContinue
        foreach ($evt in $events) {
            $criticalEvents24h++
            $eventErrors += @{
                log_name     = $logName
                event_id     = $evt.Id
                source       = $evt.ProviderName
                message      = if ($evt.Message.Length -gt 500) { $evt.Message.Substring(0, 500) } else { $evt.Message }
                time_created = $evt.TimeCreated.ToString('o')
            }
        }
    }
} catch { }

# ============================================================================
#  CLUSTER / REPLICATION HEALTH
# ============================================================================
$clusterHealth = Get-SafeValue {
    $cluster = Get-Cluster -ErrorAction Stop
    $nodes = Get-ClusterNode -ErrorAction Stop
    $downNodes = ($nodes | Where-Object { $_.State -ne 'Up' }).Count
    if ($downNodes -eq 0) { "Healthy ($($nodes.Count) nodes)" }
    else { "Degraded ($downNodes of $($nodes.Count) nodes down)" }
}

$replicationHealth = Get-SafeValue {
    $repl = Get-ADReplicationPartnerMetadata -Target $hostname -ErrorAction Stop
    if ($repl) {
        $failures = ($repl | Where-Object { $_.LastReplicationResult -ne 0 }).Count
        if ($failures -eq 0) { "Healthy" } else { "$failures partner(s) failing" }
    }
}

# ============================================================================
#  FIREWALL RULES
# ============================================================================
Write-Host "Collecting firewall rules..." -ForegroundColor Cyan

$firewallRules = @()
try {
    Get-NetFirewallRule -PolicyStore ActiveStore -ErrorAction Stop | ForEach-Object {
        $portFilter = $_ | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
        $addrFilter = $_ | Get-NetFirewallAddressFilter -ErrorAction SilentlyContinue
        $ruleSource = 'Local'
        if ($_.PolicyStoreSource -and $_.PolicyStoreSource -ne 'PersistentStore') {
            $ruleSource = $_.PolicyStoreSource
        } elseif ($_.PolicyStoreSourceType) {
            $ruleSource = $_.PolicyStoreSourceType.ToString()
        }
        $firewallRules += @{
            name           = $_.DisplayName
            direction      = $_.Direction.ToString()
            action         = $_.Action.ToString()
            protocol       = if ($portFilter) { $portFilter.Protocol } else { 'Any' }
            local_port     = if ($portFilter) { $portFilter.LocalPort -join ',' } else { '*' }
            remote_port    = if ($portFilter) { $portFilter.RemotePort -join ',' } else { '*' }
            remote_address = if ($addrFilter) { $addrFilter.RemoteAddress -join ',' } else { '*' }
            enabled        = $_.Enabled -eq 'True'
            profile        = $_.Profile.ToString()
            rule_source    = $ruleSource
        }
    }
} catch {
    Write-Warning "Could not collect firewall rules: $_"
}

# ============================================================================
#  AD GROUP POLICIES (GPOs applied to this server)
# ============================================================================
Write-Host "Collecting Group Policies..." -ForegroundColor Cyan

$gpos = @()
try {
    $gpResult = Get-GPResultantSetOfPolicy -ReportType Xml -ErrorAction Stop
    if ($gpResult) {
        $xml = [xml]$gpResult
        $computerGpos = $xml.Rsop.ComputerResults.GPO
        foreach ($gpo in $computerGpos) {
            $gpos += @{
                gpo_name   = $gpo.Name
                gpo_status = if ($gpo.Enabled -eq 'true') { 'Enabled' } else { 'Disabled' }
                gpo_guid   = $gpo.Path.Identifier.'#text'
                link_order = $gpo.Link.LinkOrder
            }
        }
    }
} catch {
    # Alternative: use gpresult /R
    try {
        $gpresult = gpresult /R /SCOPE COMPUTER 2>&1
        $inGpoSection = $false
        $linkOrder = 1
        foreach ($line in $gpresult) {
            if ($line -match 'Applied Group Policy Objects') { $inGpoSection = $true; continue }
            if ($inGpoSection -and $line -match '^\s*$') { $inGpoSection = $false; continue }
            if ($inGpoSection -and $line.Trim()) {
                $gpos += @{
                    gpo_name   = $line.Trim()
                    gpo_status = 'Applied'
                    gpo_guid   = ''
                    link_order = $linkOrder++
                }
            }
        }
    } catch { }
}

# ============================================================================
#  LOCAL SECURITY POLICIES
# ============================================================================
Write-Host "Collecting local policies..." -ForegroundColor Cyan

$localPolicies = @()
try {
    # Export security policy to temp file
    $tempFile = [System.IO.Path]::GetTempFileName()
    secedit /export /cfg $tempFile /quiet 2>&1 | Out-Null
    if (Test-Path $tempFile) {
        $content = Get-Content $tempFile -ErrorAction SilentlyContinue
        $currentCategory = "General"
        foreach ($line in $content) {
            if ($line -match '^\[(.+)\]$') {
                $currentCategory = $Matches[1]
                continue
            }
            if ($line -match '^(.+?)\s*=\s*(.+)$') {
                $localPolicies += @{
                    category    = $currentCategory
                    policy_name = $Matches[1].Trim()
                    setting     = $Matches[2].Trim()
                }
            }
        }
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Warning "Could not export local policies: $_"
}

# ============================================================================
#  BUILD PAYLOAD & SEND
# ============================================================================
Write-Host "Building inventory payload..." -ForegroundColor Cyan

$payload = @{
    hostname                = $hostname
    fqdn                    = $fqdn
    domain_or_workgroup     = $domainOrWorkgroup
    domain_type             = $domainType
    ou                      = $ou
    os_edition              = $osEdition
    os_version              = $osVersion
    os_build                = $osBuild
    install_date            = $installDate
    last_boot               = $lastBoot
    activation_status       = $activationStatus
    is_virtual              = $isVirtual
    hypervisor              = $hypervisor
    cpu_model               = $cpuModel
    cpu_cores               = $cpuCores
    cpu_usage               = $cpuUsage
    ram_total_gb            = $ramTotalGB
    ram_used_gb             = $ramUsedGB
    last_patch_date         = $lastPatchDate
    missing_critical_updates = $missingCriticalCount
    wsus_server             = $wsusServer
    reboot_pending          = $rebootPending
    antivirus_product       = $avProduct
    antivirus_status        = $avStatus
    bitlocker_status        = $bitlockerStatus
    rdp_enabled             = $rdpEnabled
    nla_enabled             = $nlaEnabled
    last_admin_login        = $lastAdminLogin
    last_user_login         = $lastUserLogin
    last_security_scan      = $lastSecurityScan
    critical_events_24h     = $criticalEvents24h
    cluster_health          = $clusterHealth
    replication_health      = $replicationHealth
    ip_addresses            = $ipAddresses
    disks                   = $disks
    roles                   = $roles
    services                = $services
    local_admins            = $localAdmins
    missing_updates         = $missingUpdates
    event_errors            = $eventErrors
    firewall_rules          = $firewallRules
    gpos                    = $gpos
    local_policies          = $localPolicies
}

$json = $payload | ConvertTo-Json -Depth 10 -Compress

# Fix encoding — ensure proper UTF-8 for non-ASCII characters (åäö etc.)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$jsonBytes = $utf8NoBom.GetBytes($json)

Write-Host "Sending inventory to $ApiUrl ..." -ForegroundColor Cyan
Write-Host "Payload size: $([math]::Round($jsonBytes.Length / 1KB, 1)) KB" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $ApiUrl -Method POST -Body $jsonBytes -ContentType 'application/json; charset=utf-8' -Headers @{
        'X-API-Key' = $ApiKey
    } -UseBasicParsing -TimeoutSec 30

    if ($response.ok) {
        Write-Host "SUCCESS: Inventory submitted for $hostname (Server ID: $($response.serverId))" -ForegroundColor Green
    } else {
        Write-Warning "Server returned unexpected response: $($response | ConvertTo-Json -Compress)"
    }
} catch {
    Write-Error "FAILED to submit inventory: $_"
    Write-Error "Status: $($_.Exception.Response.StatusCode.value__)"
    exit 1
}

Write-Host "Inventory collection complete." -ForegroundColor Green
