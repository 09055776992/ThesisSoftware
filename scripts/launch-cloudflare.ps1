# SCHOLAR System - Cloudflare Launcher with Auto URL Capture
# Launches AI-Backend, establishes Cloudflare tunnels, auto-updates .env files with tunnel URLs,
# and then starts Backend and FrontEnd with the new environment variables configured.

param(
    [switch]$SkipFrontend,   # Pass -SkipFrontend to skip starting FrontEnd
    [switch]$SkipBackend,    # Pass -SkipBackend to skip starting Backend
    [switch]$SkipAIBackend,  # Pass -SkipAIBackend to skip starting AI-Backend
    [switch]$NonInteractive, # Run without pausing for keypress at the end
    [switch]$ExitWhenReady   # Exit launcher once all services and tunnels are running
)

$root = Split-Path -Parent $PSScriptRoot
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  SCHOLAR System - Cloudflare Launcher" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# -- Helper: check if a port is listening -------------------------------------
function Test-Port($port) {
    $result = netstat -ano | Select-String ":$port\s"
    return ($result.Count -gt 0)
}

# -- 1. Start AI-Backend (port 8000) ------------------------------------------
if (-not $SkipAIBackend) {
    if (Test-Port 8000) {
        Write-Host "[AI-Backend] Already listening on :8000 - skipping." -ForegroundColor Yellow
    } else {
        Write-Host "[1/5] Starting AI-Backend (Python/Uvicorn, port 8000)..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", `
            "Set-Location '$root\AI-Backend'; .\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000" `
            -WindowStyle Normal
        Start-Sleep -Seconds 3
    }
} else { Write-Host "[AI-Backend] Skipped by flag." -ForegroundColor Yellow }

# -- 2. Launch Cloudflare Tunnels and capture URLs ----------------------------
Write-Host ""
Write-Host "[2/5] Starting Cloudflare tunnels..." -ForegroundColor Cyan
Write-Host "(This will take ~10-20 seconds for URLs to appear)" -ForegroundColor Gray

$backendLog  = "$env:TEMP\cf_backend.log"
$frontendLog = "$env:TEMP\cf_frontend.log"

# Clear old logs
Remove-Item $backendLog  -ErrorAction SilentlyContinue
Remove-Item $frontendLog -ErrorAction SilentlyContinue

# Start backend tunnel, logging output
$cfBackend = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cloudflared tunnel --url http://localhost:5000 2>&1 | Tee-Object -FilePath '$backendLog'" `
    -WindowStyle Normal -PassThru

# Start frontend tunnel, logging output
$cfFrontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cloudflared tunnel --url http://localhost:5173 2>&1 | Tee-Object -FilePath '$frontendLog'" `
    -WindowStyle Normal -PassThru

# -- 3. Wait for URLs to appear in logs ---------------------------------------
Write-Host ""
Write-Host "[3/5] Waiting for tunnel URLs..." -ForegroundColor Cyan

$backendUrl  = $null
$frontendUrl = $null
$timeout = 60
$elapsed = 0

while (($null -eq $backendUrl -or $null -eq $frontendUrl) -and $elapsed -lt $timeout) {
    Start-Sleep -Seconds 2
    $elapsed += 2

    if ($null -eq $backendUrl -and (Test-Path $backendLog)) {
        $match = Select-String -Path $backendLog -Pattern 'https://[a-z0-9\-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($match) {
            $backendUrl = ([regex]'https://[a-z0-9\-]+\.trycloudflare\.com').Match($match.Line).Value
            Write-Host "  [Backend Tunnel]  $backendUrl" -ForegroundColor Green
        }
    }

    if ($null -eq $frontendUrl -and (Test-Path $frontendLog)) {
        $match = Select-String -Path $frontendLog -Pattern 'https://[a-z0-9\-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($match) {
            $frontendUrl = ([regex]'https://[a-z0-9\-]+\.trycloudflare\.com').Match($match.Line).Value
            Write-Host "  [Frontend Tunnel] $frontendUrl" -ForegroundColor Green
        }
    }

    Write-Host "  ...waiting ($elapsed/$timeout s)" -ForegroundColor DarkGray
}

# -- 4. Update .env files -----------------------------------------------------
if ($backendUrl -and $frontendUrl) {
    Write-Host ""
    Write-Host "[4/5] Updating .env files with fresh tunnel URLs..." -ForegroundColor Cyan

    # Update Backend/.env - FRONTEND_BASE_URL
    $backendEnv = Get-Content "$root\Backend\.env" -Raw
    $backendEnv = $backendEnv -replace 'FRONTEND_BASE_URL=.*', "FRONTEND_BASE_URL=$frontendUrl"
    Set-Content "$root\Backend\.env" $backendEnv -NoNewline
    Write-Host "  Backend\.env  -> FRONTEND_BASE_URL=$frontendUrl" -ForegroundColor Green

    # Update FrontEnd/.env - VITE_API_URL, VITE_API_BASE_URL
    $frontEnv = Get-Content "$root\FrontEnd\.env" -Raw
    $frontEnv = $frontEnv -replace 'VITE_API_URL=.*',       "VITE_API_URL=$backendUrl"
    $frontEnv = $frontEnv -replace 'VITE_API_BASE_URL=.*',  "VITE_API_BASE_URL=$backendUrl"
    Set-Content "$root\FrontEnd\.env" $frontEnv -NoNewline
    Write-Host "  FrontEnd\.env -> VITE_API_URL=$backendUrl" -ForegroundColor Green
    Write-Host "  FrontEnd\.env -> VITE_API_BASE_URL=$backendUrl" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[WARNING] Could not auto-capture tunnel URLs within $timeout seconds." -ForegroundColor Red
    Write-Host "  Please check the Cloudflare tunnel windows manually and update:" -ForegroundColor Red
    Write-Host "    FrontEnd\.env  -> VITE_API_URL=<backend_tunnel_url>" -ForegroundColor Red
    Write-Host "    Backend\.env   -> FRONTEND_BASE_URL=<frontend_tunnel_url>" -ForegroundColor Red
}

# -- 5. Start Backend and FrontEnd --------------------------------------------
Write-Host ""
Write-Host "[5/5] Starting Backend and FrontEnd..." -ForegroundColor Cyan

# Start Backend (port 5000)
if (-not $SkipBackend) {
    if (Test-Port 5000) {
        Write-Host "[Backend] Already listening on :5000 - skipping." -ForegroundColor Yellow
    } else {
        Write-Host "  Starting Backend (Node.js, port 5000)..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", `
            "Set-Location '$root\Backend'; node index.js" `
            -WindowStyle Normal
        Start-Sleep -Seconds 3
    }
} else { Write-Host "[Backend] Skipped by flag." -ForegroundColor Yellow }

# Start FrontEnd (port 5173)
if (-not $SkipFrontend) {
    if (Test-Port 5173) {
        Write-Host "[FrontEnd] Already listening on :5173 - skipping." -ForegroundColor Yellow
    } else {
        Write-Host "  Starting FrontEnd (Vite, port 5173)..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", `
            "Set-Location '$root\FrontEnd'; npm run dev" `
            -WindowStyle Normal
        Start-Sleep -Seconds 4
    }
} else { Write-Host "[FrontEnd] Skipped by flag." -ForegroundColor Yellow }

if ($backendUrl -and $frontendUrl) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "  ALL SERVICES RUNNING!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "  FRONTEND (public): $frontendUrl" -ForegroundColor Yellow
    Write-Host "  BACKEND  (public): $backendUrl"  -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Cyan

    try {
        $frontendUrl | Set-Clipboard
        Write-Host "  Frontend URL copied to clipboard!" -ForegroundColor Magenta
    } catch {}
}

if ($ExitWhenReady) {
    Write-Host "Services started successfully." -ForegroundColor Green
    return
}

if ($NonInteractive) {
    Write-Host "Running in persistent background mode..." -ForegroundColor Green
    while ($true) {
        Start-Sleep -Seconds 60
    }
} elseif ([System.Environment]::UserInteractive) {
    try {
        Write-Host ""
        Write-Host "Press any key to exit this launcher..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        while ($true) { Start-Sleep -Seconds 60 }
    }
}
