# List all registered endpoints
Write-Host "Starting server to check endpoints..." -ForegroundColor Cyan

$serverJob = Start-Job -ScriptBlock {
    cd 'c:\Programming\projects\arcmantle\weave\apps\handover\pivot\Samples\RegistryExample'
    $env:Logging__LogLevel__Microsoft.AspNetCore.Routing='Debug'
    dotnet run --no-build 2>&1
}

Start-Sleep -Seconds 5

Write-Host "`nServer output (checking for registered endpoints):" -ForegroundColor Yellow
Receive-Job $serverJob | Select-String -Pattern "endpoint|route" -Context 0,1

Write-Host "`n`nTrying different paths..." -ForegroundColor Cyan
$paths = @(
    '/_framework/blazor.web.js',
    '/blazor.web.js',
    '/_framework/bl azor.server.js',
    '/_content/Microsoft.AspNetCore.Components.Web/blazor.web.js'
)

foreach ($path in $paths) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5100$path" -Method Head -ErrorAction Stop
        Write-Host "✓ Found at: $path (HTTP $($r.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "✗ Not at: $path" -ForegroundColor Gray
    }
}

Stop-Job $serverJob
Remove-Job $serverJob
