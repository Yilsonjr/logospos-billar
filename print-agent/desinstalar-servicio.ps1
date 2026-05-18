# LogosPOS Print Agent — Desinstalador de Servicio Windows

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Ejecutar como Administrador." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

$ServiceName = "LogosPOS-PrintAgent"
$AgentDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$NssmExe     = "$AgentDir\nssm\nssm.exe"

Write-Host ""
Write-Host "  LogosPOS Print Agent - Desinstalacion" -ForegroundColor Cyan
Write-Host ""

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "  El servicio '$ServiceName' no esta instalado." -ForegroundColor Yellow
    Read-Host "`n  Presiona Enter para salir"
    exit 0
}

Write-Host "  Deteniendo servicio..."
& $NssmExe stop $ServiceName 2>$null
Start-Sleep -Seconds 2

Write-Host "  Eliminando servicio..."
& $NssmExe remove $ServiceName confirm

Write-Host ""
Write-Host "  Listo. El agente ya no arrancara automaticamente." -ForegroundColor Green
Write-Host "  Los archivos de la carpeta print-agent no fueron eliminados."
Write-Host ""
Read-Host "  Presiona Enter para cerrar"
