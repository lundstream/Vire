<#
.SYNOPSIS
    Set a server in maintenance mode via the Inventory Web API.

.DESCRIPTION
    Sends a maintenance mode request to the Inventory Web API for the local server.
    This creates a logbook entry and marks the server as in maintenance for the specified duration.

.PARAMETER ApiUrl
    The Inventory Web API base URL (e.g., https://inventory.contoso.com)

.PARAMETER ApiKey
    The API key for authentication

.PARAMETER Hours
    Duration of maintenance in hours (default: 2)

.PARAMETER Comment
    Comment to attach to the maintenance entry

.EXAMPLE
    .\Set-Maintenance.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "abc123..."

.EXAMPLE
    .\Set-Maintenance.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "abc123..." -Hours 4 -Comment "Scheduled patching"

.NOTES
    Can be run manually or from a scheduled task before maintenance windows.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter()]
    [double]$Hours = 2,

    [Parameter()]
    [string]$Comment = "Maintenance mode set from server script."
)

$ErrorActionPreference = 'Stop'

$hostname = $env:COMPUTERNAME.ToUpper()
$endpoint = "$($ApiUrl.TrimEnd('/'))/api/maintenance"

$body = @{
    hostname = $hostname
    hours    = $Hours
    comment  = $Comment
    author   = "Script ($hostname)"
} | ConvertTo-Json -Compress

Write-Host "Setting maintenance mode for $hostname ($Hours hours)..." -ForegroundColor Yellow

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $response = Invoke-RestMethod -Uri $endpoint -Method POST -Body $body -ContentType 'application/json' -Headers @{ 'X-Api-Key' = $ApiKey }

    if ($response.ok) {
        Write-Host "Maintenance mode set successfully." -ForegroundColor Green
        Write-Host "  Server:  $hostname" -ForegroundColor Cyan
        Write-Host "  Until:   $($response.until)" -ForegroundColor Cyan
        Write-Host "  Comment: $Comment" -ForegroundColor Cyan
    } else {
        Write-Host "Unexpected response from API." -ForegroundColor Red
        Write-Host ($response | ConvertTo-Json)
    }
} catch {
    Write-Host "Error setting maintenance mode: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
