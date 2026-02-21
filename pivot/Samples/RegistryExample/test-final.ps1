#!/usr/bin/env pwsh

Write-Host "`n=== Starting Blazor WASM Registry ===" -ForegroundColor Cyan

Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Set-Location "$PSScriptRoot"

Write-Host "Starting server on http://localhost:5100..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

dotnet run --no-build
