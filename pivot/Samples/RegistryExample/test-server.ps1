# Test script for RegistryExample server
Write-Host "`n=== Building and starting server ===" -ForegroundColor Cyan

# Build the projects
cd "$PSScriptRoot"
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet build --nologo --verbosity quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Start the server in background
Write-Host "Starting server..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    cd $using:PSScriptRoot
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    dotnet run --no-build --environment Development 2>&1
}

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if server is running
$listening = netstat -ano | Select-String ":5100.*LISTENING"
if (-not $listening) {
    Write-Host "`n✗ Server failed to start!" -ForegroundColor Red
    Receive-Job $serverJob
    Stop-Job $serverJob
    Remove-Job $serverJob
    exit 1
}

Write-Host "✓ Server is running on port 5100" -ForegroundColor Green

# Test endpoints
Write-Host "`n=== Testing Endpoints ===" -ForegroundColor Cyan

# Test blazor.web.js
Write-Host "`nTesting blazor.web.js..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri 'http://localhost:5100/_framework/blazor.web.js' -TimeoutSec 5
    Write-Host "✓ blazor.web.js: HTTP $($r.StatusCode), Size: $([math]::Round($r.Content.Length/1KB, 1)) KB" -ForegroundColor Green
} catch {
    Write-Host "✗ blazor.web.js: $($_.Exception.Message)" -ForegroundColor Red
}

# Test CSS
Write-Host "`nTesting CSS..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri 'http://localhost:5100/css/registry.css' -TimeoutSec 5
    Write-Host "✓ CSS: HTTP $($r.StatusCode), Size: $([math]::Round($r.Content.Length/1KB, 1)) KB" -ForegroundColor Green
} catch {
    Write-Host "✗ CSS: $($_.Exception.Message)" -ForegroundColor Red
}

# Test root page
Write-Host "`nTesting root page..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri 'http://localhost:5100/' -TimeoutSec 5
    Write-Host "✓ Root page: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Root page: $($_.Exception.Message)" -ForegroundColor Red
}

# Show server output
Write-Host "`n=== Server Output ===" -ForegroundColor Cyan
Receive-Job $serverJob

# Cleanup
Write-Host "`n=== Stopping server ===" -ForegroundColor Cyan
Stop-Job $serverJob
Remove-Job $serverJob

Write-Host "`nDone!" -ForegroundColor Green
