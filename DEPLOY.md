# 🚀 Deploy del Backend a Producción

Esta guía te lleva de cero a backend en producción + AI activa en **15 minutos**.

## Lo que vas a tener al final

```
Frontend (GitHub Pages)         Backend (Render)              DB (Render Postgres)
https://nelson2206.github.io/   https://mesasmart-backend     postgres://...
       mesasmart/         →     .onrender.com         →       (16 GB free)
                                                              
                                AI: Claude API
                                Conteo por foto
                                Campañas inteligentes
                                Smart Priority
```

---

## Parte 1 · Deploy del backend (10 minutos)

### Paso 1 · Crea cuenta en Render

[render.com/register](https://render.com/register) — usa tu mismo GitHub para login (más rápido).

Es **gratis**, sin tarjeta de crédito.

### Paso 2 · Sube los cambios al repo

En tu Mac:

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Proyecto\ Restaurantes/MesaSmart && git add . && git commit -m "feat: backend listo para producción + cliente API + login page" && git push
```

### Paso 3 · Crea el Blueprint en Render

1. En Render Dashboard, click **New +** → **Blueprint**
2. Conecta tu repo `nelson2206/mesasmart` si no está conectado
3. Render detecta el `render.yaml` automáticamente
4. Click **Apply** — Render crea:
   - Web service `mesasmart-backend`
   - Postgres database `mesasmart-db`
5. Espera ~5 minutos al primer build

### Paso 4 · Configura tus secrets en Render

Una vez creado el servicio, ve a **mesasmart-backend** → **Environment** y agrega:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | Tu API key de Claude |
| `API_BASE_URL` | La URL que te dio Render (ej: `https://mesasmart-backend-abc.onrender.com`) |

Click **Save Changes** — Render redeploya solo.

### Paso 5 · Verifica que funciona

Abre en tu navegador la URL que te dio Render + `/health`:

```
https://mesasmart-backend-abc.onrender.com/health
```

Debes ver: `{"ok":true,"ts":1234567890}`

Para confirmar que el seed corrió bien:

```
https://mesasmart-backend-abc.onrender.com/api/menu/categories?restaurantId=...
```

> **Tip:** El primer request al backend free tier toma 30-60 seg en "despertar" (cold start). Después responde instantáneamente. Para producción real, upgradea a Starter ($7/mes) que mantiene el servicio caliente.

---

## Parte 2 · Conecta el frontend (3 minutos)

### Paso 6 · Apunta el frontend al backend

Hay 2 formas:

#### Opción A — Configurar manualmente al hacer login (más simple)

1. Abre tu sitio en GitHub Pages: `https://nelson2206.github.io/mesasmart/`
2. Click en **Iniciar sesión** (badge dorado arriba)
3. En el campo **Backend URL** pega: `https://mesasmart-backend-abc.onrender.com`
4. Click **Guardar**
5. Verifica que diga `✓ Backend conectado`
6. Login con `admin@labrasa.pe` / `demo1234`

La URL queda guardada en `localStorage`, no necesitas re-ingresarla.

#### Opción B — Hardcodear la URL (mejor para todos los usuarios)

Edita `index.html` y antes del `<script src="./assets/api.js">` agrega:

```html
<script>window.MESASMART_BACKEND_URL = "https://mesasmart-backend-abc.onrender.com";</script>
```

Commitea y pushea — todos los usuarios usan ese backend automáticamente.

### Paso 7 · Probar el flujo end-to-end

1. Abre `login.html` → entra como `admin@labrasa.pe`
2. Te redirige a `admin.html` — verás KPIs reales del backend
3. En otra pestaña, abre `cocina.html` (KDS)
4. En otra, `cliente.html` (tablet)
5. Crea un pedido en cliente → debe aparecer en cocina vía Socket.io en tiempo real

---

## Parte 3 · Activar features de IA (2 minutos)

Si en Paso 4 ya pusiste `ANTHROPIC_API_KEY`, todas las features AI están activas. Verifica:

```
GET https://mesasmart-backend-abc.onrender.com/api/ai/status
```

Respuesta esperada:
```json
{
  "enabled": true,
  "model": "claude-haiku-4-5-20251001",
  "features": ["explainPriority", "suggestSequence", "classifyComplaint", "translateMenu", "recommendForCustomer"]
}
```

### Probar conteo de inventario por foto

1. Abre `erp.html` → tab **Conteo físico**
2. Click **Tomar / subir foto**
3. Sube una foto de tu refrigerador o despensa real
4. Claude Vision identifica los insumos visibles y estima cantidades
5. Confirmas y se guarda con un movimiento de kardex

### Probar generación de campañas

1. Abre `erp.html` → tab **Campañas IA**
2. Click **Generar nuevas sugerencias**
3. La IA analiza: insumos baja rotación, expiraciones, horas valle, fechas peruanas
4. Devuelve 4-6 campañas listas para lanzar

---

## Parte 4 · Mantenimiento

### Re-seed (cuando quieras restaurar la data demo)

En Render Dashboard → `mesasmart-backend` → **Shell**:

```bash
SEED_FORCE=true npx tsx prisma/seed.ts
```

### Ver logs en vivo

Dashboard → `mesasmart-backend` → **Logs**

### Auto-deploys

Cada `git push` a `main` redeploya el backend automáticamente. Render lo detecta solo.

### Custom domain

Settings → **Custom Domain** → agrega tu dominio. Render genera el SSL automáticamente.

---

## Troubleshooting

### "CORS: origin xxx not allowed"
En Render Environment, agrega tu dominio a `CORS_ORIGINS` separado por comas:
```
https://nelson2206.github.io,https://tudominio.com
```

### "Unable to connect to database"
La Postgres free de Render se duerme con el servicio. Espera 60 segundos al primer request.

### "Build failed"
Ve a Logs → busca el error. Causas comunes:
- `prisma generate` falla por permisos → ya está manejado en `postinstall`
- `prisma db push` falla → verifica que `DATABASE_URL` esté seteado (Render lo hace solo via `fromDatabase`)

### El backend va lento después de inactividad
Es el cold start del free tier. Soluciones:
- Upgradear a Starter ($7/mes) — mantiene el servicio caliente
- Configurar [UptimeRobot](https://uptimerobot.com) gratis para pingear `/health` cada 5 min

### AI no responde
1. Verifica en Render Environment que `ANTHROPIC_API_KEY` está seteado
2. Verifica que `AI_FEATURES_ENABLED=true`
3. Llama `/api/ai/status` — debe devolver `enabled: true`
4. Si la key es inválida, el endpoint devuelve `503 ai_disabled` → revisa la key

---

## Costos esperados

| Recurso | Plan free | Plan recomendado prod |
|---|---|---|
| Backend (Render) | 750h/mes free | Starter $7/mes |
| Postgres (Render) | Free 90 días, luego se borra | $7/mes (1GB) |
| GitHub Pages | Gratis ilimitado | — |
| Claude API | Pay per use (~$1-5/mes en demo) | Mismo |
| **Total free** | **$0** (limitado) | — |
| **Total prod** | — | **~$15/mes** |

---

## Próximos pasos (opcional)

Una vez tengas todo funcionando:

1. **Custom domain** — `mesasmart.pe` con SSL automático
2. **Replace demo data** — tu restaurante real
3. **Pasarela real** — Culqi/Niubiz/IziPay para tarjetas reales
4. **OSE real** — Nubefact para emisión SUNAT real
5. **Mobile PWA** — instalar en tablets como app nativa
6. **Analytics** — Plausible/Umami para medir uso
