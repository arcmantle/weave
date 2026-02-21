# Check what HTML is being served
Write-Host "Fetching root page HTML..." -ForegroundColor Cyan

$serverJob = Start-Job -ScriptBlock {
    cd 'c:\Programming\projects\arcmantle\weave\apps\handover\pivot\Samples\RegistryExample'
    dotnet run --no-build 2>&1
}

Start-Sleep -Seconds 5

try {
    $html = (Invoke-WebRequest -Uri 'http://localhost:5100/').Content
    Write-Host "`nHTML Content:" -ForegroundColor Yellow
    Write-Host $html

    Write-Host "`n`nSearching for script tags:" -ForegroundColor Yellow
    $html | Select-String -Pattern '<script.*?>' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { Write-Host $_.Value -ForegroundColor Cyan }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Stop-Job $serverJob
Remove-Job $serverJob
