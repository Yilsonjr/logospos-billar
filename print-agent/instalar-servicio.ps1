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

# ── 1. Localizar Node.js ─────────────────────────────────────
Write-Host "  [1/4] Buscando Node.js..." -ForegroundColor White

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
    Write-Host "  [ERROR] Node.js no encontrado." -ForegroundColor Red
    Write-Host "  Descargalo desde: https://nodejs.org  (v18 o superior)"
    Read-Host "`n  Presiona Enter para salir"
    exit 1
}

$nodeVersion = & "$NodeExe" --version
Write-Host "  OK -- Node.js $nodeVersion en: $NodeExe" -ForegroundColor Green
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

& $NssmExe install   $ServiceName $NodeExe "server.js"
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

# ── 4. Iniciar servicio ──────────────────────────────────────
Write-Host "  [4/4] Iniciando servicio..." -ForegroundColor White

& $NssmExe start $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "  OK -- Servicio corriendo." -ForegroundColor Green
} else {
    Write-Host "  ADVERTENCIA: puede tardar unos segundos." -ForegroundColor Yellow
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
