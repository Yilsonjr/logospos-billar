# LogosPOS — Manual de Instalación del Agente de Impresión

Guía para instalar el agente de impresión en cualquier PC con impresora térmica,
ya sea en una nueva sucursal, restaurante o punto de venta.

---

## Dos formas de instalar

| Modo | Requiere Node.js | Archivos a copiar |
|------|-----------------|-------------------|
| **Ejecutable .exe** (recomendado) | ❌ No | `dist/print-agent.exe` + `instalar-servicio.bat` |
| Script Node.js | ✅ Sí (v20+) | Carpeta `print-agent/` completa |

---

## Opción A — Ejecutable .exe (sin Node.js)

### Paso 1 — Copiar archivos al PC

Copia solo estos dos archivos a `C:\LogosPOS\`:
```
C:\LogosPOS\
  print-agent.exe
  instalar-servicio.bat
```

### Paso 2 — Generar certificado HTTPS

```powershell
cd C:\LogosPOS
.\print-agent.exe --gen-cert
```

### Paso 3 — Instalar como servicio Windows

Abre **PowerShell como Administrador**:

```powershell
cd C:\LogosPOS
.\instalar-servicio.bat
```

---

## Opción B — Script Node.js

### Paso 1 — Requisitos

| Requisito | Versión | Descarga |
|-----------|---------|----------|
| Windows   | 10 / 11 | — |
| Node.js   | 20 LTS+ | https://nodejs.org |

### Paso 2 — Copiar el agente al PC

Copia la carpeta `print-agent` a `C:\LogosPOS\print-agent\`.

### Paso 3 — Instalar como servicio Windows

Abre **PowerShell como Administrador**:

```powershell
cd C:\LogosPOS\print-agent
.\instalar-servicio.bat
```

El servicio `LogosPOS-PrintAgent` quedará registrado y se iniciará automáticamente con Windows.

### Comandos útiles del servicio

```powershell
net start  LogosPOS-PrintAgent   # Iniciar
net stop   LogosPOS-PrintAgent   # Detener
net start  LogosPOS-PrintAgent   # Reiniciar (después de detener)
```

Para verificar que está corriendo:
```
http://localhost:3000/health
```
Debe mostrar: `{"status":"ok","agent":"LogosPOS Print Agent",...}`

---

## Paso 3 — Crear túnel HTTPS con Cloudflare

El túnel permite que la app web (HTTPS) se comunique con el agente local sin bloqueos del navegador.

### 3.1 Instalar cloudflared

```powershell
winget install --id Cloudflare.cloudflared
```

### 3.2 Autenticarse (abre el navegador)

```powershell
cloudflared tunnel login
```

Inicia sesión con tu cuenta de Cloudflare (gratuita en https://cloudflare.com).

### 3.3 Crear el túnel (usa un nombre descriptivo por local)

```powershell
cloudflared tunnel create print-agent-nombre-del-local
```

Ejemplo para una segunda sucursal:
```powershell
cloudflared tunnel create print-agent-sucursal-norte
```

Anota el **UUID del túnel** que aparece en la salida.

### 3.4 Crear el archivo de configuración

Crea el archivo `C:\Users\USUARIO\.cloudflared\config.yml` con este contenido
(reemplaza `<UUID>` con el UUID del paso anterior):

```yaml
tunnel: <UUID>
credentials-file: C:\Users\USUARIO\.cloudflared\<UUID>.json

ingress:
  - service: http://localhost:3000
```

### 3.5 Instalar el túnel como servicio Windows

```powershell
cloudflared service install
net start cloudflared
```

### 3.6 Obtener la URL del túnel

```powershell
cloudflared tunnel info print-agent-nombre-del-local
```

La URL será del tipo:
```
https://<uuid>.cfargotunnel.com
```

Guarda esta URL — es la que vas a configurar en la app. **Es permanente y no cambia aunque reinicies el PC.**

---

## Paso 4 — Generar certificado HTTPS (opcional pero recomendado)

Solo necesario si vas a usar el agente desde `http://localhost` además del túnel:

```powershell
cd C:\LogosPOS\print-agent
node gen-cert.js
```

Reinicia el agente después:
```powershell
net stop LogosPOS-PrintAgent
net start LogosPOS-PrintAgent
```

---

## Paso 5 — Configurar en la app LogosPOS

1. Inicia sesión con el usuario del negocio
2. Ve a **Restaurante → Impresoras** (o la ruta `/restaurante/impresoras`)
3. En el campo **URL del agente**, pega la URL del túnel:
   ```
   https://<uuid>.cfargotunnel.com
   ```
4. Haz click en **Guardar**
5. Haz click en **↺** (verificar) — debe aparecer el badge verde **"Agente conectado"**

---

## Paso 6 — Agregar impresoras

Por cada impresora física del local:

1. Click en **Nueva Impresora**
2. Completa el formulario:

| Campo | Impresora de red | Impresora USB |
|-------|-----------------|---------------|
| Tipo conexión | Red / TCP-IP | USB (local) |
| IP | 192.168.x.x | — |
| Puerto TCP | 9100 (ESC/POS estándar) | — |
| Puerto Windows | — | USB001 / USB002 / COM3 |
| Tipo estación | Cocina / Caja / Barra / Comanda | Igual |

3. Para impresoras USB, haz click en **Detectar** para listar las instaladas en Windows
4. Guarda y usa el botón **Prueba** para verificar que imprime correctamente

---

## Esquema por sucursal

Cada local/negocio tiene su propia configuración independiente:

```
Negocio A — Restaurante Centro
  URL agente → https://abc123.cfargotunnel.com
  Impresoras:
    Cocina  → 192.168.1.10:9100
    Caja    → USB001

Negocio B — Restaurante Norte
  URL agente → https://xyz789.cfargotunnel.com
  Impresoras:
    Cocina  → 192.168.0.20:9100
    Caja    → 192.168.0.21:9100
```

Cada negocio tiene su propio agente, su propia URL de túnel y sus propias impresoras. No interfieren entre sí.

---

## Solución de problemas

### El agente no inicia

```powershell
# Ver logs del servicio
Get-EventLog -LogName Application -Source NSSM -Newest 20

# O ejecutar manualmente para ver el error en consola
cd C:\LogosPOS\print-agent
node server.js
```

### Error: puerto 3000 ocupado

El agente intenta automáticamente los puertos 3001–3005. Si cambia de puerto,
actualiza la URL del agente en la app (agrega el nuevo puerto al final de la URL del túnel no aplica — el túnel siempre apunta al 3000).

Forzar el puerto en la configuración del servicio:
```
Variable de entorno: PRINT_AGENT_PORT=3001
```

### El badge aparece rojo ("Agente desconectado")

1. Verifica que el servicio esté corriendo: `net start LogosPOS-PrintAgent`
2. Verifica que el túnel esté activo: `net start cloudflared`
3. Prueba la URL del túnel directamente en el navegador: `https://<uuid>.cfargotunnel.com/health`

### La impresora no imprime (USB)

1. Verifica que la impresora esté encendida y conectada
2. En la app, usa **Detectar** para confirmar el puerto (USB001, USB002, etc.)
3. El puerto puede cambiar si desconectas y reconectas el USB — vuelve a detectar

### La impresora no imprime (red)

1. Verifica que la impresora esté en la misma red que el PC del agente
2. Prueba el ping desde el PC: `ping 192.168.x.x`
3. En la app, usa el botón **Ping** en la tarjeta de la impresora para probar la conexión TCP

---

## Desinstalar

```powershell
# Desinstalar agente
cd C:\LogosPOS\print-agent
.\desinstalar-servicio.bat

# Desinstalar túnel
net stop cloudflared
cloudflared service uninstall
cloudflared tunnel delete print-agent-nombre-del-local
```

---

*LogosPOS — Módulo de Impresión v1.0*
