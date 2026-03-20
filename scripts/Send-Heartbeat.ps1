<#
.SYNOPSIS
    Lightweight heartbeat script — sends CPU, RAM, disk, and service status every minute.
    Designed to run as a Scheduled Task under the SYSTEM account.

.DESCRIPTION
    Collects: CPU usage, RAM usage, disk space, auto-start services that are stopped.
    POSTs to /api/heartbeat. The server must already be registered via the full
    Collect-ServerInventory.ps1 script (run on a longer interval).

.PARAMETER ApiUrl
    The Inventory Web API base URL (e.g., https://inventory.contoso.com)

.PARAMETER ApiKey
    The API key for authentication

.EXAMPLE
    .\Send-Heartbeat.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "abc123..."

.NOTES
    Run as: SYSTEM (Scheduled Task)
    Frequency: Every 1 minute
    Resource impact: ~5 MB RAM, <200ms CPU per run
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey
)

$ErrorActionPreference = 'SilentlyContinue'

# --- CPU Usage (average across all cores) ---
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
if ($null -eq $cpu) { $cpu = 0 }

# --- RAM Usage ---
$os = Get-CimInstance Win32_OperatingSystem
$ramUsedGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)

# --- Disk Space ---
$disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
    @{
        drive_letter  = $_.DeviceID
        volume_label  = $_.VolumeName
        size_gb       = [math]::Round($_.Size / 1GB, 2)
        free_gb       = [math]::Round($_.FreeSpace / 1GB, 2)
        file_system   = $_.FileSystem
    }
}

# --- Services: auto-start services that are NOT running ---
$services = Get-Service | Where-Object {
    $_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'
} | ForEach-Object {
    @{
        name         = $_.ServiceName
        display_name = $_.DisplayName
        status       = $_.Status.ToString()
        start_type   = $_.StartType.ToString()
    }
}

$stoppedCount = @($services).Count

# --- Build payload ---
$payload = @{
    hostname         = $env:COMPUTERNAME
    cpu_usage        = [math]::Round($cpu, 1)
    ram_used_gb      = $ramUsedGB
    stopped_services = $stoppedCount
    disks            = @($disks)
    services         = @($services)
} | ConvertTo-Json -Depth 3 -Compress

# --- POST to API ---
$uri = $ApiUrl.TrimEnd('/') + '/api/heartbeat'
try {
    $response = Invoke-RestMethod -Uri $uri -Method POST -Body $payload `
        -ContentType 'application/json' `
        -Headers @{ 'x-api-key' = $ApiKey } `
        -TimeoutSec 10 `
        -ErrorAction Stop
}
catch {
    # Silent fail — heartbeat misses are detected server-side
    # Uncomment for debugging:
    # Write-Warning "Heartbeat failed: $_"
}
