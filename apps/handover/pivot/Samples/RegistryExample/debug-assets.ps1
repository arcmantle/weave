#!/usr/bin/env pwsh

Write-Host "`n=== Debugging Static Web Assets ===" -ForegroundColor Cyan

# Check what files exist in build output
$wasmFiles = Get-ChildItem 'c:\Programming\projects\arcmantle\weave\apps\handover\pivot\Pivot.Registry.Client\bin\Debug\net10.0\wwwroot\_framework\blazor.*.js' -ErrorAction SilentlyContinue

if ($wasmFiles) {
    Write-Host "`n✓ WASM files found in client build output:" -ForegroundColor Green
    $wasmFiles | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n✗ No WASM files found in client build output!" -ForegroundColor Red
}

# Kill any existing processes
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Build and run
Write-Host "`nBuilding and running..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot"

$job = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    dotnet run --no-build 2>&1 | Out-String | Write-Host
}

Start-Sleep -Seconds 5

# Check if server is running
$listening = netstat -ano | Select-String ":5100.*LISTENING"
if (-not $listening) {
    Write-Host "Server not started!" -ForegroundColor Red
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -ErrorAction SilentlyContinue
    exit 1
}

# Test the actual file path that failed
Write-Host "`nTesting: http://localhost:5100/_framework/blazor.webassembly.js" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:5100/_framework/blazor.webassembly.js' -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ SUCCESS: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red

    # Try with hash
    if ($wasmFiles) {
        $fileName = $wasmFiles[0].Name
        Write-Host "`nTrying with actual filename: $fileName" -ForegroundColor Yellow
        try {
            $response2 = Invoke-WebRequest -Uri "http://localhost:5100/_framework/$fileName" -UseBasicParsing -TimeoutSec 5
            Write-Host "✓ File exists with hash: $($response2.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "✗ Even hashed version failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Cleanup
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -ErrorAction SilentlyContinue
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Debug Complete ===" -ForegroundColor Cyan
