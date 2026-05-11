# Guía de Despliegue - Aremko CLI

Esta guía te ayudará a desplegar aremko-cli en producción usando Vercel (frontend) y Render (backend).

## Requisitos Previos

- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [Render](https://render.com)
- Repositorio en GitHub con el código de aremko-cli
- Acceso al sistema Django de producción en https://www.aremko.cl

## Paso 1: Desplegar el Backend en Render

### 1.1 Crear Nuevo Web Service

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio `aremko-cli`

### 1.2 Configurar el Servicio

**Configuración básica:**
- **Name:** `aremko-cli-backend`
- **Region:** Oregon (US West) o la más cercana
- **Branch:** `main`
- **Root Directory:** `backend`
- **Environment:** Docker
- **Plan:** Free (para empezar)

**Variables de Entorno:**

Agrega las siguientes variables en la sección "Environment":

```
PORT=8080
BOOKING_SYSTEM_URL=https://www.aremko.cl
ENABLE_BOOKINGS=true
```

### 1.3 Deploy

1. Click en "Create Web Service"
2. Render detectará automáticamente el `Dockerfile` y `render.yaml`
3. Espera a que el despliegue termine (5-10 minutos)
4. Copia la URL del servicio (ej: `https://aremko-cli-backend.onrender.com`)

### 1.4 Verificar Backend

Prueba que el backend esté funcionando:

```bash
curl https://aremko-cli-backend.onrender.com/api/health
```

Deberías ver:
```json
{"status":"ok","timestamp":"..."}
```

## Paso 2: Desplegar el Frontend en Vercel

### 2.1 Crear Nuevo Proyecto

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "Add New..." → "Project"
3. Importa tu repositorio de GitHub
4. Selecciona el repositorio `aremko-cli`

### 2.2 Configurar el Proyecto

**Configuración básica:**
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `npm run build` (autodetectado)
- **Output Directory:** `.next` (autodetectado)

### 2.3 Variables de Entorno

En la sección "Environment Variables", agrega:

| Variable | Value | Notas |
|----------|-------|-------|
| `AUTH_SECRET` | `[generar nuevo]` | Ver instrucciones abajo |
| `NEXTAUTH_URL` | `https://tu-dominio.vercel.app` | Se actualiza después del deploy |
| `NEXT_PUBLIC_API_URL` | `https://aremko-cli-backend.onrender.com` | URL del backend de Render |

**Generar AUTH_SECRET:**

```bash
openssl rand -base64 32
```

Copia el resultado y úsalo como valor de `AUTH_SECRET`.

### 2.4 Deploy

1. Click en "Deploy"
2. Espera a que el despliegue termine (2-5 minutos)
3. Copia la URL del proyecto (ej: `https://aremko-cli.vercel.app`)

### 2.5 Actualizar NEXTAUTH_URL

1. Ve a Project Settings → Environment Variables
2. Actualiza `NEXTAUTH_URL` con la URL real de Vercel
3. Redeploy el proyecto: Deployments → Latest → "Redeploy"

## Paso 3: Verificar la Integración

### 3.1 Probar Autenticación

1. Abre tu URL de Vercel en el navegador
2. Deberías ver la página de login
3. Prueba con las credenciales:
   - **Usuario:** `jorge`
   - **Contraseña:** `jorge2026`

### 3.2 Probar Datos del Dashboard

1. Una vez autenticado, verifica que el dashboard cargue
2. Las métricas deberían mostrar datos reales del sistema Django
3. Verifica que aparezca el badge "Datos Reales" en las tarjetas

### 3.3 Probar CORS

Si ves errores de CORS en la consola del navegador:

1. Verifica que el backend esté recibiendo las peticiones
2. Asegúrate que la URL en `NEXT_PUBLIC_API_URL` sea correcta
3. Revisa los logs en Render Dashboard

## Paso 4: Configuración de Dominio (Opcional)

### 4.1 Frontend (Vercel)

1. Ve a Project Settings → Domains
2. Click en "Add Domain"
3. Ingresa tu dominio (ej: `app.aremko.cl`)
4. Sigue las instrucciones para configurar DNS

### 4.2 Backend (Render)

1. Ve a tu servicio en Render
2. Settings → Custom Domain
3. Ingresa tu dominio (ej: `api.aremko.cl`)
4. Configura el registro CNAME en tu proveedor DNS

### 4.3 Actualizar Variables

Después de configurar dominios personalizados:

1. Actualiza `NEXTAUTH_URL` en Vercel con tu nuevo dominio
2. Actualiza `NEXT_PUBLIC_API_URL` en Vercel con tu dominio del backend
3. Redeploy ambos servicios

## Paso 5: Monitoreo

### Backend (Render)

- Logs: Dashboard → tu servicio → Logs
- Métricas: Dashboard → tu servicio → Metrics
- Health checks: Automáticos cada 5 minutos

### Frontend (Vercel)

- Analytics: Dashboard → tu proyecto → Analytics
- Logs: Dashboard → tu proyecto → Deployments → View Function Logs
- Errores: Dashboard → tu proyecto → Speed Insights

## Troubleshooting

### Backend no responde

1. Verifica logs en Render
2. Comprueba que las variables de entorno estén configuradas
3. Prueba el health endpoint manualmente

### Frontend no carga datos

1. Abre Developer Tools (F12) → Console
2. Busca errores de CORS o network
3. Verifica que `NEXT_PUBLIC_API_URL` sea correcta
4. Comprueba que el backend esté respondiendo

### Errores de autenticación

1. Verifica que `AUTH_SECRET` esté configurado
2. Comprueba que `NEXTAUTH_URL` coincida con tu dominio
3. Limpia cookies del navegador
4. Prueba en modo incógnito

### CORS errors

Si el frontend no puede conectarse al backend:

1. Verifica que ambos servicios estén en HTTPS
2. Comprueba que las URLs no tengan trailing slashes
3. Revisa los logs del backend para ver las peticiones

## Seguridad en Producción

### Recomendaciones

1. **Cambia las contraseñas por defecto** en `frontend/lib/users.ts`
2. **Usa variables de entorno** para secretos (nunca en el código)
3. **Habilita HTTPS** (automático en Vercel y Render)
4. **Monitorea logs** regularmente para detectar accesos no autorizados
5. **Actualiza dependencias** regularmente con `npm update`

### Cambiar Contraseñas

Para cambiar contraseñas de usuarios:

1. Genera un nuevo hash:
```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('nueva-contraseña', 10));"
```

2. Actualiza el hash en `frontend/lib/users.ts`
3. Commit y push los cambios
4. Vercel auto-deployer los cambios

## Costos Estimados

### Plan Gratuito

- **Vercel:**
  - 100 GB bandwidth/mes
  - Proyectos ilimitados
  - Dominios personalizados

- **Render:**
  - 750 horas/mes (suficiente para 1 servicio 24/7)
  - 100 GB bandwidth/mes
  - Duerme después de 15 min de inactividad

### Plan Pagado (si necesitas más recursos)

- **Vercel Pro:** $20/mes
  - Mejor rendimiento
  - Sin límites de bandwidth

- **Render Starter:** $7/mes
  - Servicio siempre activo
  - Mejor CPU y memoria

## Soporte

Si tienes problemas durante el despliegue:

- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- Next.js: https://nextjs.org/docs
- GitHub Issues: https://github.com/tu-usuario/aremko-cli/issues

---

**Última actualización:** Mayo 2026
**Versión:** 1.0.0
