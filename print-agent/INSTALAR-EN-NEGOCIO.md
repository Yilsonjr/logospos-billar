# LogosPOS — Guía de Instalación en un Negocio Nuevo

Guía completa para instalar el agente de impresión y el tunnel Cloudflare
en el PC de un cliente, desde cero hasta imprimir.

---

## Requisitos previos

- Cuenta Cloudflare con dominio `logospos.com` activo
- `cloudflared` instalado en **tu PC** (el de desarrollo)
- PC del cliente con Windows 10/11
- Impresora(s) térmica(s) conectadas a la red local del negocio

---

## FASE 1 — En tu PC (antes de ir al negocio)

Haces esto **una sola vez por cada negocio nuevo**.

### 1.1 — Crear el tunnel en Cloudflare

Abre PowerShell en tu PC y ejecuta:

```powershell
cloudflared tunnel create nombre-negocio
```

Reemplaza `nombre-negocio` con un identificador del negocio (sin espacios ni tildes).
Ejemplos: `restaurante-norte`, `pizzeria-centro`, `bar-tropical`

**Resultado esperado:**
```
Created tunnel restaurante-norte with id 1732e4de-c518-4e91-9825-61d2403a6ad9
```

Anota el **UUID** (el número largo tipo `1732e4de-c518-4e91-9825-61d2403a6ad9`).

---

### 1.2 — Crear el subdominio en DNS

```powershell
cloudflared tunnel route dns nombre-negocio nombre-negocio.logospos.com
```

Ejemplo:
```powershell
cloudflared tunnel route dns restaurante-norte restaurante-norte.logospos.com
```

Esto crea automáticamente el registro DNS en Cloudflare.
La URL permanente del negocio quedará como:
```
https://restaurante-norte.logospos.com
```

---

### 1.3 — Crear el archivo config.yml

Crea un archivo llamado `config.yml` con este contenido.
Reemplaza `nombre-negocio` y `<UUID>` con los valores reales:

```yaml
tunnel: nombre-negocio
credentials-file: C:\Windows\System32\config\systemprofile\.cloudflared\<UUID>.json

ingress:
  - hostname: nombre-negocio.logospos.com
    service: http://localhost:3000
  - service: http_status:404
```

**Ejemplo real:**
```yaml
tunnel: restaurante-norte
credentials-file: C:\Windows\System32\config\systemprofile\.cloudflared\1732e4de-c518-4e91-9825-61d2403a6ad9.json

ingress:
  - hostname: restaurante-norte.logospos.com
    service: http://localhost:3000
  - service: http_status:404
```

> **Importante:** La ruta del `credentials-file` debe apuntar siempre a
> `C:\Windows\System32\config\systemprofile\.cloudflared\` — esa es la
> carpeta del sistema donde corre el servicio de Windows.

---

### 1.4 — Localizar el archivo de credenciales

El archivo JSON de credenciales se generó en tu PC al crear el tunnel.
Está en:
```
C:\Users\TU_USUARIO\.cloudflared\<UUID>.json
```

Ejemplo:
```
C:\Users\USUARIO\.cloudflared\1732e4de-c518-4e91-9825-61d2403a6ad9.json
```

---

### 1.5 — Preparar el USB de instalación

Copia estos archivos a un USB o carpeta compartida:

```
LogosPOS-Instalador\
  print-agent.exe            ← el agente de impresión
  instalar-servicio.bat      ← instala el agente como servicio Windows
  instalar-servicio.ps1      ← script del instalador del agente
  instalar-tunnel.bat        ← instala el tunnel cloudflare
  instalar-tunnel.ps1        ← script del instalador del tunnel
  cloudflared.exe            ← el cliente de Cloudflare
  1732e4de-...json           ← credenciales del tunnel (el UUID.json de tu PC)
  config.yml                 ← el que creaste en el paso 1.3
  nssm\
    nssm.exe                 ← gestor de servicios Windows
```

> `cloudflared.exe` lo encuentras en `C:\Windows\System32\cloudflared.exe`
> en tu PC (si lo instalaste con winget) o en los releases de GitHub.

---

## FASE 2 — En el PC del cliente

Conecta el USB al PC del cliente y copia la carpeta a `C:\LogosPOS\`.

Abre **PowerShell o CMD como Administrador** y ejecuta:

### 2.1 — Instalar el agente de impresión

```
C:\LogosPOS\instalar-servicio.bat
```

El instalador:
- Descarga NSSM si no está incluido
- Registra `LogosPOS-PrintAgent` como servicio Windows
- Lo inicia automáticamente
- Abre el puerto 3000 en el firewall

**Verificar que funciona:**
```
http://localhost:3000/health
```
Debe mostrar: `{"status":"ok","agent":"LogosPOS Print Agent","version":"1.0.0"}`

---

### 2.2 — Instalar el tunnel Cloudflare

```
C:\LogosPOS\instalar-tunnel.bat
```

El instalador:
- Copia `cloudflared.exe` a `C:\Windows\System32\`
- Copia las credenciales y `config.yml` al directorio del sistema
- Registra `Cloudflared` como servicio Windows
- Lo inicia automáticamente

**Verificar que el tunnel está activo:**

Abre en el browser:
``` 
https://nombre-negocio.logospos.com/health

ejemplo: 
https://burgos-restaurant.logospos.com/health
```
Debe mostrar: `{"status":"ok","agent":"LogosPOS Print Agent","version":"1.0.0"}`

Si ves ese mensaje, el tunnel está conectado correctamente.

---

## FASE 3 — Configurar en la app LogosPOS

1. Inicia sesión con el usuario del negocio
2. Ve a **Restaurante → Impresoras**
3. En **URL del agente** escribe la URL del tunnel:
   ```
   https://nombre-negocio.logospos.com
   ```
4. Clic en **Guardar** → debe aparecer el badge **verde "Agente conectado"**

---

## FASE 4 — Agregar las impresoras

Por cada impresora física del negocio:

1. Clic en **Nueva Impresora**
2. Completa los datos:

| Campo | Impresora de red |
|-------|-----------------|
| Nombre | Cocina / Barra / Caja |
| Tipo conexión | Red / TCP-IP |
| IP | La IP de la impresora (ej: `192.168.0.100`) |
| Puerto TCP | `9100` (estándar ESC/POS) |
| Tipo estación | Cocina / Barra / Caja según corresponda |
| Copias | 1 (o más si necesitas) |
| Corte automático | Activado |

3. Clic en **Guardar**
4. Clic en **Ping** → debe responder en verde
5. Clic en **Prueba** → debe imprimir una hoja de prueba

---

## Desde ese momento — Funcionamiento automático

| Servicio | Nombre Windows | Comportamiento |
|----------|---------------|----------------|
| Agente de impresión | `LogosPOS-PrintAgent` | Arranca con Windows |
| Tunnel Cloudflare | `Cloudflared` | Arranca con Windows |

El cliente enciende el PC → todo arranca solo → imprime sin intervención.
La URL `https://nombre-negocio.logospos.com` es **permanente** y nunca cambia.

---

## Esquema final por negocio

```
App LogosPOS (Vercel - HTTPS)
         ↓
https://restaurante-norte.logospos.com   ← URL permanente
         ↓
Cloudflare Tunnel  (servicio Windows en el PC del negocio)
         ↓
Agente localhost:3000  (servicio Windows en el PC del negocio)
         ↓
    ┌────┴──────────────────┐
    ↓                       ↓                    ↓
Cocina                  Barra                 Caja
192.168.0.100:9100    192.168.0.101:9100    192.168.0.102:9100
```

---

## Múltiples negocios

Cada negocio tiene su propio tunnel y subdominio. Un solo dominio `logospos.com` sirve para todos:

| Negocio | URL del agente |
|---------|---------------|
| Restaurante Norte | `https://restaurante-norte.logospos.com` |
| Pizzería Centro | `https://pizzeria-centro.logospos.com` |
| Bar Tropical | `https://bar-tropical.logospos.com` |

Para cada nuevo negocio: repite la Fase 1 con un nombre diferente.

---

## Comandos de gestión (desde el PC del cliente)

```powershell
# Ver estado de los servicios
sc query LogosPOS-PrintAgent
sc query Cloudflared

# Reiniciar el agente
net stop LogosPOS-PrintAgent && net start LogosPOS-PrintAgent

# Reiniciar el tunnel
net stop Cloudflared && net start Cloudflared

# Desinstalar todo
C:\LogosPOS\desinstalar-servicio.bat
cloudflared service uninstall
```

---

## Solución de problemas

### Badge rojo en la app ("Agente desconectado")
1. Verifica el agente: abre `http://localhost:3000/health` en el PC del negocio
2. Verifica el tunnel: abre `https://nombre-negocio.logospos.com/health` en cualquier browser
3. Si el agente responde pero el tunnel no → `net stop Cloudflared && net start Cloudflared`
4. Si ninguno responde → `net start LogosPOS-PrintAgent` y `net start Cloudflared`

### La impresora no imprime
1. Verifica que la impresora esté encendida y en la misma red
2. Usa el botón **Ping** en la app → si falla, la IP es incorrecta o la impresora está apagada
3. Haz ping desde el PC del negocio: `ping 192.168.0.100`

### El tunnel no conecta después de reinstalar
- Asegúrate de que el `config.yml` tiene la ruta correcta del `.json` en `C:\Windows\System32\config\systemprofile\.cloudflared\`
- El archivo `.json` debe estar en esa misma carpeta del sistema

---

*LogosPOS — Print Agent v1.0 | logospos.com*
