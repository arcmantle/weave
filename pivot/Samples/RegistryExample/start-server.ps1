# Simple server start
Write-Host "Building..." -ForegroundColor Cyan
dotnet build --nologo --verbosity quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nStarting server on http://localhost:5100" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host "`nTest blazor.web.js at: http://localhost:5100/_framework/blazor.web.js" -ForegroundColor Cyan
    Write-Host "`n" -ForegroundColor White
    dotnet run --no-build
}
