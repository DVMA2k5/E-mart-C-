# Runs the customer app for phones on ANY network (4G, another Wi-Fi, friends' phones):
#   - Expo Go app : scan the QR code (Expo's own tunnel)
#   - Web version : open the printed https://xxxx.trycloudflare.com link in the phone's browser
# Free Cloudflare quick tunnels expose the backend (localhost:5099) and the Expo web server (localhost:8081).
# The backend must already be running (run-backend.bat or `dotnet run --launch-profile http`).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $root "Staff-E-commerce-main\customer-app"

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) {
    $candidate = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    if (Test-Path $candidate) { $cloudflared = $candidate }
}
if (-not $cloudflared) {
    Write-Host "cloudflared is not installed. Install it once with:" -ForegroundColor Yellow
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    Write-Host "then open a NEW terminal and run this script again."
    exit 1
}

try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:5099/api/storefront/categories" | Out-Null
} catch {
    Write-Host "Backend is not answering on http://localhost:5099. Start it first (run-backend.bat)." -ForegroundColor Yellow
    exit 1
}

$tunnels = @()
function Open-Tunnel([int]$port) {
    $log = Join-Path $env:TEMP "emart-cloudflared-$port.log"
    Remove-Item $log -ErrorAction SilentlyContinue
    $proc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel --no-autoupdate --url http://localhost:$port" `
        -RedirectStandardError $log -WindowStyle Hidden -PassThru
    $script:tunnels += $proc
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $log) {
            $match = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1
            if ($match) { return $match.Matches[0].Value }
        }
    }
    throw "Could not open a tunnel for port $port. See $log"
}

try {
    $apiUrl = Open-Tunnel 5099
    $webUrl = Open-Tunnel 8081
    $env:EXPO_PUBLIC_API_URL = "$apiUrl/api"

    Write-Host ""
    Write-Host "Backend API : $env:EXPO_PUBLIC_API_URL" -ForegroundColor Green
    Write-Host "Expo Go app : scan the QR code below with Expo Go" -ForegroundColor Green
    Write-Host "Web on phone: $webUrl   (open in Chrome/Safari; first load takes a while)" -ForegroundColor Green
    Write-Host "Keep this window open; Ctrl+C stops everything."
    Write-Host ""

    Set-Location $appDir
    if (-not (Test-Path "node_modules\expo\package.json")) { npm.cmd ci }
    npx.cmd expo start --go --tunnel --clear --port 8081
} finally {
    $tunnels | ForEach-Object { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue }
}
