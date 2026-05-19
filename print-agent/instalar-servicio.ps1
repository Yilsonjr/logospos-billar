# LogosPOS Print Agent — Instalador de Servicio Windows
# Requiere ejecutarse como Administrador

$ErrorActionPreference = "Stop"

# ── Verificar Administrador ──────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "  [ERROR] Ejecutar como Administrador." -ForegroundColor Red
    Write-Host "  Haz clic derecho en instalar-servicio.bat y selecciona 'Ejecutar como administrador'."
    Read-Host "`n  Presiona Enter para salir"
    exit 1
}

$AgentDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceName = "LogosPOS-PrintAgent"
$NssmDir    = "$AgentDir\nssm"
$NssmExe    = "$NssmDir\nssm.exe"
$LogsDir    = "$AgentDir\logs"

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   LogosPOS Print Agent - Instalacion de Servicio"      -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Directorio: $AgentDir"
Write-Host ""

# ── 1. Detectar modo: .exe (SEA) o script Node.js ───────────
Write-Host "  [1/4] Detectando modo de instalacion..." -ForegroundColor White

$ExeFile    = "$AgentDir\print-agent.exe"
$ServerFile = "$AgentDir\server.js"
$AppExe     = $null
$AppArgs    = $null

if (Test-Path $ExeFile) {
    # Opcion A — ejecutable independiente (no requiere Node.js)
    $AppExe  = $ExeFile
    $AppArgs = ""
    Write-Host "  OK -- Modo EXE: $ExeFile" -ForegroundColor Green
} elseif (Test-Path $ServerFile) {
    # Opcion B — script Node.js
    $NodeExe = $null
    $candidates = @(
        "C:\Program Files\nodejs\node.exe",
        "C:\Program Files (x86)\nodejs\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $NodeExe = $c; break }
    }
    if (-not $NodeExe) {
        $cmd = Get-Command node -ErrorAction SilentlyContinue
        if ($cmd) { $NodeExe = $cmd.Source }
    }
    if (-not $NodeExe) {
        Write-Host "  [ERROR] Node.js no encontrado y print-agent.exe tampoco." -ForegroundColor Red
        Write-Host "  Opciones:"
        Write-Host "    A) Coloca print-agent.exe en: $AgentDir"
        Write-Host "    B) Instala Node.js desde: https://nodejs.org  (v20+)"
        Read-Host "`n  Presiona Enter para salir"
        exit 1
    }
    $nodeVersion = & "$NodeExe" --version
    $AppExe  = $NodeExe
    $AppArgs = "server.js"
    Write-Host "  OK -- Modo Node.js $nodeVersion: $NodeExe" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] No se encontro print-agent.exe ni server.js en:" -ForegroundColor Red
    Write-Host "  $AgentDir"
    Read-Host "`n  Presiona Enter para salir"
    exit 1
}
Write-Host ""

# ── 2. Obtener NSSM ──────────────────────────────────────────
Write-Host "  [2/4] Verificando NSSM..." -ForegroundColor White

if (-not (Test-Path $NssmExe)) {
    Write-Host "  Descargando NSSM desde nssm.cc..."
    if (-not (Test-Path $NssmDir)) { New-Item -ItemType Directory -Path $NssmDir | Out-Null }
    try {
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" `
            -OutFile "$NssmDir\nssm.zip" -UseBasicParsing
        Expand-Archive -Path "$NssmDir\nssm.zip" -DestinationPath "$NssmDir\tmp" -Force
        Copy-Item "$NssmDir\tmp\nssm-2.24\win64\nssm.exe" $NssmExe -Force
        Remove-Item "$NssmDir\tmp" -Recurse -Force
        Remove-Item "$NssmDir\nssm.zip" -Force
        Write-Host "  OK -- NSSM descargado." -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] No se pudo descargar NSSM: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Descargalo manualmente desde: https://nssm.cc/download"
        Write-Host "  Extrae nssm.exe (carpeta win64) y copialo a:"
        Write-Host "  $NssmExe"
        Read-Host "`n  Presiona Enter para salir"
        exit 1
    }
} else {
    Write-Host "  OK -- NSSM ya presente." -ForegroundColor Green
}
Write-Host ""

# ── 3. Registrar servicio ────────────────────────────────────
Write-Host "  [3/4] Registrando servicio de Windows..." -ForegroundColor White

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Eliminando instalacion anterior..."
    & $NssmExe stop $ServiceName 2>$null
    & $NssmExe remove $ServiceName confirm 2>$null
    Start-Sleep -Seconds 2
}

if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir | Out-Null }

& $NssmExe install   $ServiceName $AppExe $AppArgs
& $NssmExe set       $ServiceName AppDirectory    $AgentDir
& $NssmExe set       $ServiceName DisplayName     "LogosPOS Print Agent"
& $NssmExe set       $ServiceName Description     "Agente de impresion termica LogosPOS"
& $NssmExe set       $ServiceName Start           SERVICE_AUTO_START
& $NssmExe set       $ServiceName AppStdout       "$LogsDir\agent.log"
& $NssmExe set       $ServiceName AppStderr       "$LogsDir\agent-error.log"
& $NssmExe set       $ServiceName AppRotateFiles  1
& $NssmExe set       $ServiceName AppRotateBytes  5242880
& $NssmExe set       $ServiceName AppRestartDelay 3000

Write-Host "  OK -- Servicio registrado." -ForegroundColor Green
Write-Host ""

# ── 4. Regla de Firewall ─────────────────────────────────────
Write-Host "  [4/5] Abriendo puerto 3000 en Firewall de Windows..." -ForegroundColor White

$fwRule = Get-NetFirewallRule -DisplayName "LogosPOS Print Agent" -ErrorAction SilentlyContinue
if ($fwRule) {
    Write-Host "  OK -- Regla ya existente." -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -DisplayName "LogosPOS Print Agent" `
            -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
        Write-Host "  OK -- Puerto 3000 habilitado." -ForegroundColor Green
    } catch {
        Write-Host "  ADVERTENCIA: No se pudo crear la regla de firewall: $_" -ForegroundColor Yellow
        Write-Host "  Ejecuta manualmente:" -ForegroundColor Yellow
        Write-Host "  New-NetFirewallRule -DisplayName 'LogosPOS Print Agent' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow" -ForegroundColor Gray
    }
}
Write-Host ""

# ── 5. Iniciar servicio ──────────────────────────────────────
Write-Host "  [5/5] Iniciando servicio..." -ForegroundColor White

& $NssmExe start $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "  OK -- Servicio corriendo." -ForegroundColor Green
} else {
    Write-Host "  ADVERTENCIA: el servicio puede tardar unos segundos en iniciar." -ForegroundColor Yellow
    Write-Host "  Revisa logs en: $LogsDir\agent-error.log" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   Instalacion completada exitosamente"                  -ForegroundColor Green
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Agente activo en:  http://localhost:3000"
Write-Host "  Verifica abriendo: http://localhost:3000/health"
Write-Host ""
Write-Host "  El agente arrancara automaticamente con Windows."
Write-Host "  Logs en: $LogsDir\"
Write-Host ""
Read-Host "  Presiona Enter para cerrar"
