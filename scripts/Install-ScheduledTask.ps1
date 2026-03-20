<#
.SYNOPSIS
    Creates a Windows Scheduled Task to run the Server Inventory collection script.
    Run this script as Administrator on each server you want to inventory.

.PARAMETER ApiUrl
    The Inventory Web API endpoint

.PARAMETER ApiKey
    The API key for authentication

.PARAMETER IntervalHours
    How often to run the collection (default: 4 hours)

.EXAMPLE
    .\Install-ScheduledTask.ps1 -ApiUrl "https://inventory.contoso.com/api/inventory" -ApiKey "your-api-key-here"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [int]$IntervalHours = 4
)

$ErrorActionPreference = 'Stop'

$taskName = "ServerInventoryCollection"
$scriptPath = Join-Path $PSScriptRoot "Collect-ServerInventory.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Script not found: $scriptPath"
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing scheduled task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Build the action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -ApiUrl `"$ApiUrl`" -ApiKey `"$ApiKey`""

# Trigger: every N hours, starting now
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours $IntervalHours)

# Run as SYSTEM with highest privileges
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Collects server inventory and sends to Inventory Web API"

Write-Host ""
Write-Host "Scheduled task '$taskName' created successfully." -ForegroundColor Green
Write-Host "  Runs as: SYSTEM" -ForegroundColor Gray
Write-Host "  Interval: Every $IntervalHours hours" -ForegroundColor Gray
Write-Host "  API URL:  $ApiUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "To run immediately: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
