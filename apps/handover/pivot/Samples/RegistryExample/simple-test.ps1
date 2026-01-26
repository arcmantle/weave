# Simple test - just check if blazor.web.js works
Write-Host "Starting server..." -ForegroundColor Cyan
$env:ASPNETCORE_ENVIRONMENT = 'Development'

$job = Start-Job {
    cd 'c:\Programming\projects\arcmantle\weave\apps\handover\pivot\Samples\RegistryExample'
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    dotnet run --no-build --environment Development 2>&1
}

Write-Host "Waiting 8 seconds for full startup..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host "`nTesting blazor.web.js..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest 'http://localhost:5100/_framework/blazor.web.js' -TimeoutSec 10
    Write-Host "✓ SUCCESS! Status: $($response.StatusCode), Size: $([math]::Round($response.Content.Length/1KB, 1)) KB" -ForegroundColor Green
} catch {
    Write-Host "✗ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nStopping server..." -ForegroundColor Yellow
Stop-Job $job
Remove-Job $job
Get-Process -Name dotnet -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
