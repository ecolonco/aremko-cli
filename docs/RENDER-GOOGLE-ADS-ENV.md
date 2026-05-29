# Setup Google Ads en Render (8 env vars)

Aremko-cli ya tiene toda la integración Go + frontend lista (commit pendiente). Para activarla en producción, configurar las env vars en Render. Cuando las 5 críticas están presentes, `EnableGoogleAds` se auto-activa sin tocar `ENABLE_GOOGLE_ADS=true` adicional.

## Env vars requeridas

```
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=5399750827          # 539-975-0827 sin guiones
GOOGLE_ADS_LOGIN_CUSTOMER_ID=              # opcional, ID del MCC si la cuenta está administrada
GOOGLE_ADS_REFUGIO_CAMPAIGN_ID=            # ID numérico de la campaña Refugio Search (obtener tras primer login)
GOOGLE_ADS_BUDGET_CLP=100000               # presupuesto prepagado declarado para la card
```

## Cómo obtener cada uno

### 1. `GOOGLE_ADS_DEVELOPER_TOKEN`

Viene de un **Manager Account (MCC)** de Google Ads aprobado por Google.

- Si no hay MCC: crear uno en https://ads.google.com/intl/es_CL/home/tools/manager-accounts/. Es gratis pero tarda 1-3 días hábiles en aprobarse.
- Si ya existe el MCC del proyecto Eunacom (mencionado por el agente Django): reutilizar ese token.
- Una vez aprobado, ir a Tools → API Center → copiar el Developer Token.

**Tip mientras espera aprobación:** Google ofrece un test developer token que limita a cuentas de test, pero **no sirve para producción**. Para Aremko necesitamos el token aprobado.

### 2-3. `GOOGLE_ADS_CLIENT_ID` + `GOOGLE_ADS_CLIENT_SECRET`

Vienen de un OAuth 2.0 Client creado en Google Cloud Console.

- Ir a https://console.cloud.google.com/apis/credentials.
- "Create Credentials" → "OAuth client ID" → tipo "Desktop app" (más simple para refresh tokens).
- Copiar Client ID y Client Secret.

### 4. `GOOGLE_ADS_REFRESH_TOKEN`

Se genera una sola vez usando OAuth Playground:

1. Abrir https://developers.google.com/oauthplayground/.
2. Engranaje arriba a la derecha → "Use your own OAuth credentials" → pegar Client ID y Client Secret de arriba.
3. En "Step 1", scope manual: `https://www.googleapis.com/auth/adwords`.
4. Click "Authorize APIs" → loguearse con la cuenta Gmail que es **owner** de la cuenta Google Ads (en este caso `ecolonco1@gmail.com`).
5. Aceptar permisos.
6. En "Step 2", click "Exchange authorization code for tokens".
7. Copiar el **Refresh Token** que aparece. **Guardarlo bien, no se puede regenerar sin volver a pasar por todo el flow.**

### 5. `GOOGLE_ADS_CUSTOMER_ID`

`539-975-0827` sin guiones → `5399750827`.

### 6. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (opcional)

Solo si la cuenta Aremko (539-975-0827) está **administrada** por un MCC. Si es así, va el ID del MCC sin guiones. Si la cuenta es independiente, dejar vacío.

### 7. `GOOGLE_ADS_REFUGIO_CAMPAIGN_ID`

Después del primer login con el refresh token, obtener el ID con curl manual o desde el smoke-test del propio backend:

```bash
curl -s "https://aremko-cli-backend.onrender.com/api/v1/google-ads/summary" | jq '.data.campaigns[] | {id: .campaign_id, name: .campaign_name}'
```

La que se llame `Refugio - Search - Lanzamiento Junio 2026` → ese ID en la env var.

## Cómo lo verifico

Después de setear las vars en Render (que dispara redeploy):

```bash
# Health del endpoint
curl -s "https://aremko-cli-backend.onrender.com/api/v1/google-ads/summary?date_start=2026-05-29&date_stop=2026-06-08" | jq '.data.summary'

# Refugio dedicado
curl -s "https://aremko-cli-backend.onrender.com/api/v1/google-ads/refugio" | jq '.data.summary'

# Search terms
curl -s "https://aremko-cli-backend.onrender.com/api/v1/google-ads/search-terms" | jq '.data.terms[0:5]'
```

Si responde 200 con data, el dashboard se llena solo en pestaña Social del brief. La card "Comparativa Canales" aparece automáticamente.

## Troubleshooting común

- **401/PERMISSION_DENIED**: el refresh token no tiene scope `adwords` o el user no tiene acceso a la cuenta. Volver a generar el refresh token con el Gmail correcto.
- **DEVELOPER_TOKEN_NOT_APPROVED**: el token está pendiente de aprobación por Google. Esperar 1-3 días hábiles.
- **CUSTOMER_NOT_FOUND**: revisar que el `CUSTOMER_ID` esté sin guiones y que el `LOGIN_CUSTOMER_ID` (si aplica) sea el del MCC que administra la cuenta.
- **400 INVALID_GAQL**: el cliente Go está pidiendo fields que no existen en la versión de la API. Si Google sube la API a v19+, actualizar `apiBaseURL` en `internal/googleads/client.go`.

## Workaround "Google Ads Scripts" (NO recomendado)

El brief de Django mencionó un workaround usando Google Ads Scripts (JavaScript dentro de Google Ads que exporta JSON a un endpoint Django). NO lo implementé porque genera dos pipelines distintos para los mismos datos y deuda técnica fuerte. Si por algún motivo no se puede usar la API oficial (token rechazado, MCC bloqueado), abrir una issue y evaluamos.
