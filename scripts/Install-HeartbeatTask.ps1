<#
.SYNOPSIS
    Creates a Windows Scheduled Task to run the heartbeat script every minute.
    Run this script as Administrator on each server you want to monitor.

.PARAMETER ApiUrl
    The Inventory Web API base URL (e.g., https://inventory.contoso.com)

.PARAMETER ApiKey
    The API key for authentication

.PARAMETER IntervalMinutes
    How often to send heartbeat (default: 1 minute)

.EXAMPLE
    .\Install-HeartbeatTask.ps1 -ApiUrl "https://inventory.contoso.com" -ApiKey "your-api-key-here"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [int]$IntervalMinutes = 1
)

$ErrorActionPreference = 'Stop'

$taskName = "ServerHeartbeat"
$scriptPath = Join-Path $PSScriptRoot "Send-Heartbeat.ps1"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Script not found: $scriptPath"
    exit 1
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing scheduled task '$taskName'..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Build the action
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" -ApiUrl `"$ApiUrl`" -ApiKey `"$ApiKey`""

# Trigger: every N minutes, repeating indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

# Run as SYSTEM with highest privileges
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -RunLevel Highest `
    -LogonType ServiceAccount

# Settings: allow running on battery, don't stop if going on battery, run even if missed
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 30) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Sends lightweight heartbeat (CPU, RAM, disk, services) to Inventory Web API every $IntervalMinutes minute(s)." | Out-Null

Write-Host ""
Write-Host "Scheduled task '$taskName' created successfully!" -ForegroundColor Green
Write-Host "  Script:   $scriptPath" -ForegroundColor Cyan
Write-Host "  API URL:  $ApiUrl" -ForegroundColor Cyan
Write-Host "  Interval: Every $IntervalMinutes minute(s)" -ForegroundColor Cyan
Write-Host "  Run as:   SYSTEM" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test manually:" -ForegroundColor Yellow
Write-Host "  .\Send-Heartbeat.ps1 -ApiUrl `"$ApiUrl`" -ApiKey `"$ApiKey`"" -ForegroundColor White
