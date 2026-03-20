<#
.SYNOPSIS
    Domain GPO & DNS Collection Script
    Collects all Group Policy Objects and DNS zones from Active Directory and POSTs to the Vire API.
    Must be run on a Domain Controller or a machine with the GroupPolicy and DnsServer modules installed.

.DESCRIPTION
    Gathers: GPO names, GUIDs, status, creation/modification times, WMI filters,
    descriptions, link targets, and policy settings.
    Also collects DNS zones and records if the DnsServer module is available.
    Requires the GroupPolicy PowerShell module (RSAT or Domain Controller).

.PARAMETER ApiUrl
    The Vire API base URL (e.g., https://inventory.contoso.com)

.PARAMETER ApiKey
    The API key for authentication

.PARAMETER Domain
    The domain FQDN to query. Defaults to the current domain.

.EXAMPLE
    .\Collect-DomainGPO.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "abc123..."

.EXAMPLE
    .\Collect-DomainGPO.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "abc123..." -Domain "contoso.com"

.NOTES
    Run as: Domain Admin or account with GPO read permissions
    Requires: GroupPolicy PowerShell module (RSAT), optionally DnsServer module
    Frequency: Daily recommended
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $false)]
    [string]$Domain
)

$ErrorActionPreference = 'Stop'

# ============================================================================
#  VALIDATE PREREQUISITES
# ============================================================================
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Module -ListAvailable -Name GroupPolicy)) {
    Write-Error "GroupPolicy module not found. Install RSAT or run on a Domain Controller."
    exit 1
}

Import-Module GroupPolicy -ErrorAction Stop

# Determine domain
if (-not $Domain) {
    try {
        $Domain = (Get-ADDomain).DNSRoot
    } catch {
        $Domain = $env:USERDNSDOMAIN
    }
}

if (-not $Domain) {
    Write-Error "Could not determine domain. Specify -Domain parameter."
    exit 1
}

Write-Host "Collecting GPOs for domain: $Domain" -ForegroundColor Cyan

# ============================================================================
#  COLLECT GPOs
# ============================================================================
$allGPOs = @()

try {
    $gpos = Get-GPO -All -Domain $Domain
} catch {
    Write-Error "Failed to enumerate GPOs: $_"
    exit 1
}

$total = $gpos.Count
$i = 0

foreach ($gpo in $gpos) {
    $i++
    Write-Progress -Activity "Collecting GPO data" -Status "$i of $total - $($gpo.DisplayName)" -PercentComplete (($i / $total) * 100)

    $gpoData = @{
        name              = $gpo.DisplayName
        guid              = $gpo.Id.ToString()
        status            = $gpo.GpoStatus.ToString()
        creation_time     = $gpo.CreationTime.ToString('o')
        modification_time = $gpo.ModificationTime.ToString('o')
        wmi_filter        = if ($gpo.WmiFilter) { $gpo.WmiFilter.Name } else { $null }
        description       = $gpo.Description
        links             = @()
        settings          = @()
    }

    # Collect GPO links by generating XML report
    try {
        [xml]$report = Get-GPOReport -Guid $gpo.Id -ReportType Xml -Domain $Domain

        # Extract links from SOM (Scope of Management)
        $ns = @{ gpo = "http://www.microsoft.com/GroupPolicy/Settings" }
        $linkNodes = $report.SelectNodes("//gpo:LinksTo", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))

        if ($linkNodes) {
            foreach ($link in $linkNodes) {
                $somPath = $link.SelectSingleNode("gpo:SOMPath", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))
                $somEnabled = $link.SelectSingleNode("gpo:Enabled", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))
                $noOverride = $link.SelectSingleNode("gpo:NoOverride", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))

                $gpoData.links += @{
                    target   = if ($somPath) { $somPath.InnerText } else { "" }
                    enabled  = if ($somEnabled) { $somEnabled.InnerText -eq "true" } else { $true }
                    enforced = if ($noOverride) { $noOverride.InnerText -eq "true" } else { $false }
                    order    = $null
                }
            }
        }

        # Extract policy settings (Computer + User sections)
        foreach ($section in @("Computer", "User")) {
            $configNode = $report.SelectSingleNode("//gpo:${section}", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))
            if (-not $configNode) { continue }

            $extensionNodes = $configNode.SelectNodes("gpo:ExtensionData/gpo:Extension", (New-Object System.Xml.XmlNamespaceManager($report.NameTable)))
            if (-not $extensionNodes) { continue }

            foreach ($ext in $extensionNodes) {
                # Collect all settings elements
                $policyNodes = $ext.SelectNodes(".//*[local-name()='Policy']")
                foreach ($pol in $policyNodes) {
                    $catNode = $pol.SelectSingleNode("*[local-name()='Category']")
                    $nameNode = $pol.SelectSingleNode("*[local-name()='Name']")
                    $stateNode = $pol.SelectSingleNode("*[local-name()='State']")

                    $gpoData.settings += @{
                        area     = $section
                        category = if ($catNode) { $catNode.InnerText } else { "" }
                        name     = if ($nameNode) { $nameNode.InnerText } else { "" }
                        value    = if ($stateNode) { $stateNode.InnerText } else { "" }
                    }
                }

                # Registry settings
                $regNodes = $ext.SelectNodes(".//*[local-name()='RegistrySetting']")
                foreach ($reg in $regNodes) {
                    $nameNode = $reg.SelectSingleNode("*[local-name()='Name']")
                    $valueNode = $reg.SelectSingleNode("*[local-name()='Value']/*[local-name()='Element']")
                    $stateNode = $reg.SelectSingleNode("*[local-name()='State']")
                    $keyPath = $reg.SelectSingleNode("*[local-name()='KeyPath']")

                    $settingName = if ($nameNode) { $nameNode.InnerText } elseif ($keyPath) { $keyPath.InnerText } else { "" }
                    $settingValue = if ($stateNode) { $stateNode.InnerText } elseif ($valueNode) { $valueNode.InnerText } else { "" }

                    if ($settingName) {
                        $gpoData.settings += @{
                            area     = $section
                            category = "Registry"
                            name     = $settingName
                            value    = $settingValue
                        }
                    }
                }

                # Security settings (Account/Local Policies)
                $secNodes = $ext.SelectNodes(".//*[local-name()='Account'] | .//*[local-name()='SecurityOptions'] | .//*[local-name()='AuditSetting']")
                foreach ($sec in $secNodes) {
                    $nameNode = $sec.SelectSingleNode("*[local-name()='Name']")
                    $valNodes = $sec.SelectNodes("*[local-name()='SettingNumber'] | *[local-name()='SettingString'] | *[local-name()='SettingBoolean']")

                    $settingValue = ""
                    foreach ($vn in $valNodes) {
                        if ($vn.InnerText) { $settingValue = $vn.InnerText; break }
                    }

                    if ($nameNode) {
                        $gpoData.settings += @{
                            area     = $section
                            category = "Security"
                            name     = $nameNode.InnerText
                            value    = $settingValue
                        }
                    }
                }
            }
        }
    } catch {
        Write-Warning "Could not parse report for GPO '$($gpo.DisplayName)': $_"
    }

    $allGPOs += $gpoData
}

Write-Progress -Activity "Collecting GPO data" -Completed

Write-Host "Collected $($allGPOs.Count) GPOs" -ForegroundColor Green

# ============================================================================
#  POST TO API
# ============================================================================
$payload = @{
    domain = $Domain
    gpos   = $allGPOs
}

$json = $payload | ConvertTo-Json -Depth 10 -Compress
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$jsonBytes = $utf8NoBom.GetBytes($json)

$apiEndpoint = $ApiUrl.TrimEnd('/') + '/api/gpo'

Write-Host "Posting GPO data to $apiEndpoint ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $apiEndpoint `
        -Method POST `
        -Body $jsonBytes `
        -ContentType 'application/json; charset=utf-8' `
        -Headers @{ 'X-Api-Key' = $ApiKey }

    if ($response.ok) {
        Write-Host "Successfully posted $($response.count) GPOs for domain $Domain" -ForegroundColor Green
    } else {
        Write-Warning "API returned unexpected response: $($response | ConvertTo-Json -Depth 2)"
    }
} catch {
    Write-Error "Failed to post GPO data: $_"
    exit 1
}

# ============================================================================
#  COLLECT DNS ZONES & RECORDS
# ============================================================================
if (Get-Module -ListAvailable -Name DnsServer) {
    Import-Module DnsServer -ErrorAction SilentlyContinue

    Write-Host "`nCollecting DNS zones..." -ForegroundColor Cyan

    $allZones = @()
    try {
        $dnsZones = Get-DnsServerZone -ErrorAction Stop | Where-Object { $_.ZoneName -ne 'TrustAnchors' }

        $total = $dnsZones.Count
        $i = 0

        foreach ($zone in $dnsZones) {
            $i++
            Write-Progress -Activity "Collecting DNS zones" -Status "$i of $total - $($zone.ZoneName)" -PercentComplete (($i / $total) * 100)

            $records = @()
            try {
                $dnsRecords = Get-DnsServerResourceRecord -ZoneName $zone.ZoneName -ErrorAction Stop |
                    Where-Object { $_.RecordType -in @('A','AAAA','CNAME','MX','NS','PTR','SRV','TXT','SOA') } |
                    Select-Object -First 500

                foreach ($rec in $dnsRecords) {
                    $data = switch ($rec.RecordType) {
                        'A'     { $rec.RecordData.IPv4Address.IPAddressToString }
                        'AAAA'  { $rec.RecordData.IPv6Address.IPAddressToString }
                        'CNAME' { $rec.RecordData.HostNameAlias }
                        'MX'    { "$($rec.RecordData.Preference) $($rec.RecordData.MailExchange)" }
                        'NS'    { $rec.RecordData.NameServer }
                        'PTR'   { $rec.RecordData.PtrDomainName }
                        'SRV'   { "$($rec.RecordData.Priority) $($rec.RecordData.Weight) $($rec.RecordData.Port) $($rec.RecordData.DomainName)" }
                        'TXT'   { ($rec.RecordData.DescriptiveText -join ' ') }
                        'SOA'   { "$($rec.RecordData.PrimaryServer) $($rec.RecordData.ResponsiblePerson)" }
                        default { $rec.RecordData.ToString() }
                    }

                    $records += @{
                        name = $rec.HostName
                        type = $rec.RecordType
                        data = $data
                        ttl  = $rec.TimeToLive.ToString()
                    }
                }
            } catch {
                Write-Warning "Could not read records for zone '$($zone.ZoneName)': $_"
            }

            $allZones += @{
                name              = $zone.ZoneName
                type              = $zone.ZoneType
                is_reverse_lookup = $zone.IsReverseLookupZone
                is_ad_integrated  = $zone.IsDsIntegrated
                dynamic_update    = $zone.DynamicUpdate.ToString()
                aging_enabled     = $zone.AgingEnabled
                record_count      = $records.Count
                records           = $records
            }
        }

        Write-Progress -Activity "Collecting DNS zones" -Completed
        Write-Host "Collected $($allZones.Count) DNS zones with $(($allZones | ForEach-Object { $_.record_count } | Measure-Object -Sum).Sum) records" -ForegroundColor Green

        # POST DNS data
        $dnsPayload = @{
            domain = $Domain
            zones  = $allZones
        }

        $dnsJson = $dnsPayload | ConvertTo-Json -Depth 10 -Compress
        $dnsJsonBytes = $utf8NoBom.GetBytes($dnsJson)

        $dnsEndpoint = $ApiUrl.TrimEnd('/') + '/api/dns'

        Write-Host "Posting DNS data to $dnsEndpoint ..." -ForegroundColor Cyan

        try {
            $dnsResponse = Invoke-RestMethod -Uri $dnsEndpoint `
                -Method POST `
                -Body $dnsJsonBytes `
                -ContentType 'application/json; charset=utf-8' `
                -Headers @{ 'X-Api-Key' = $ApiKey }

            if ($dnsResponse.ok) {
                Write-Host "Successfully posted $($dnsResponse.count) DNS zones for domain $Domain" -ForegroundColor Green
            } else {
                Write-Warning "DNS API returned unexpected response: $($dnsResponse | ConvertTo-Json -Depth 2)"
            }
        } catch {
            Write-Warning "Failed to post DNS data: $_"
        }
    } catch {
        Write-Warning "Failed to enumerate DNS zones: $_"
    }
} else {
    Write-Host "`nDnsServer module not available — skipping DNS collection." -ForegroundColor Yellow
    Write-Host "Install the DNS Server role or RSAT DNS tools to collect DNS data." -ForegroundColor Yellow
}
