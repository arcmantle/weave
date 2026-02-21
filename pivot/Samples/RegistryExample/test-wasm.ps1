#!/usr/bin/env pwsh

Write-Host "`n=== Testing Blazor WASM Registry ===" -ForegroundColor Cyan

# Kill any existing dotnet processes
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Build the projects
Write-Host "`nBuilding projects..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\..\Pivot.Registry"
dotnet build --nologo --verbosity quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed for Pivot.Registry!" -ForegroundColor Red
    exit 1
}

Set-Location "$PSScriptRoot"
dotnet build --nologo --verbosity quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed for RegistryExample!" -ForegroundColor Red
    exit 1
}

Write-Host "Build succeeded!" -ForegroundColor Green

# Start the server in background
Write-Host "`nStarting server..." -ForegroundColor Yellow
$job = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    dotnet run --no-build 2>&1 | Out-Null
}

# Wait for server to start
Start-Sleep -Seconds 5

# Check if port is listening
$listening = netstat -ano | Select-String ":5100.*LISTENING"
if (-not $listening) {
    Write-Host "Server failed to start!" -ForegroundColor Red
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Server is running on http://localhost:5100" -ForegroundColor Green

# Test index.html
Write-Host "`nTesting index.html..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5100/' -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ index.html: HTTP $($response.StatusCode), Size: $([math]::Round($response.Content.Length/1KB, 1)) KB" -ForegroundColor Green
} catch {
    Write-Host "✗ index.html failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test blazor.webassembly.js
Write-Host "`nTesting blazor.webassembly.js..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5100/_framework/blazor.webassembly.js' -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ blazor.webassembly.js: HTTP $($response.StatusCode), Size: $([math]::Round($response.Content.Length/1KB, 1)) KB" -ForegroundColor Green
} catch {
    Write-Host "✗ blazor.webassembly.js failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test API endpoint
Write-Host "`nTesting API endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5100/api/plugins' -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ /api/plugins: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ /api/plugins failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Swagger
Write-Host "`nTesting Swagger..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5100/swagger/index.html' -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Swagger UI: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Swagger UI failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Cleanup
Write-Host "`nCleaning up..." -ForegroundColor Yellow
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -ErrorAction SilentlyContinue
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Open http://localhost:5100 in your browser to view the app" -ForegroundColor Yellow
