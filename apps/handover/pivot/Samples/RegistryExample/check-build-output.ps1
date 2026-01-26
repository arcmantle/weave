Write-Host "Checking build output for framework files..." -ForegroundColor Cyan

$basePath = "C:\Programming\projects\arcmantle\weave\apps\handover\pivot\Samples\RegistryExample\bin\Debug\net10.0"

Write-Host "`nLooking for _framework directory..."
$frameworkPath = Join-Path $basePath "wwwroot\_framework"
if (Test-Path $frameworkPath) {
    Write-Host "✓ Found _framework folder" -ForegroundColor Green
    Get-ChildItem $frameworkPath | Select-Object Name, Length | Format-Table
} else {
    Write-Host "✗ No _framework folder found" -ForegroundColor Red
}

Write-Host "`nLooking for any blazor files in output..."
Get-ChildItem $basePath -Recurse -Filter "*blazor*.js" -ErrorAction SilentlyContinue | Select-Object FullName

Write-Host "`nChecking static web assets manifest..."
$manifestPath = Join-Path $basePath "RegistryExample.staticwebassets.runtime.json"
if (Test-Path $manifestPath) {
    Write-Host "✓ Found static web assets manifest" -ForegroundColor Green
    $content = Get-Content $manifestPath -Raw | ConvertFrom-Json
    Write-Host "Assets count: $($content.Assets.Count)"
    $content.Assets | Where-Object { $_.Url -like "*blazor*" } | Select-Object Url | Format-Table
} else {
    Write-Host "✗ No static web assets manifest found" -ForegroundColor Red
}
