# MesaSmart · Backend

API REST + WebSocket para el ecosistema MesaSmart. Construido con Express, Prisma, Socket.io y TypeScript.

## Quick start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# (edita .env con tus valores; para empezar deja MOCK_* en true)

# 3. Generar cliente Prisma + crear DB SQLite + sembrar datos demo
npm run db:migrate
npm run db:seed

# 4. Arrancar en modo desarrollo (hot reload)
npm run dev
```

Listo. Backend corriendo en `http://localhost:3001`.

### Probar

```bash
# Health
curl http://localhost:3001/health

# Login (admin demo)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@labrasa.pe","password":"demo1234"}'

# Listar mesas (con token)
TOKEN="<paste-token-from-login>"
curl http://localhost:3001/api/tables -H "Authorization: Bearer $TOKEN"
```

---

## Usuarios demo

| Email | Rol | Password |
|---|---|---|
| `admin@labrasa.pe` | ADMIN | `demo1234` |
| `maria@labrasa.pe` | WAITER | `demo1234` |
| `juan@labrasa.pe` | WAITER | `demo1234` |
| `carlos@labrasa.pe` | WAITER | `demo1234` |
| `cocina@labrasa.pe` | KITCHEN | `demo1234` |
| `caja@labrasa.pe` | CASHIER | `demo1234` |

---

## Estructura

```
backend/
├── src/
│   ├── index.ts                  # entry — Express + Socket.io
│   ├── prisma.ts                  # Prisma singleton
│   ├── config/env.ts              # validación con Zod
│   ├── middleware/
│   │   ├── auth.ts                # JWT
│   │   └── error.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── menu.routes.ts
│   │   ├── tables.routes.ts
│   │   ├── orders.routes.ts
│   │   ├── modifications.routes.ts
│   │   ├── calls.routes.ts
│   │   ├── payments.routes.ts
│   │   ├── reports.routes.ts
│   │   └── ai.routes.ts
│   ├── services/
│   │   ├── priority.service.ts    # Smart Priority (rule-based)
│   │   ├── ai.service.ts          # Claude integration (opcional)
│   │   └── sunat.service.ts       # OSE / facturación
│   ├── sockets/
│   │   └── index.ts               # rooms y emit helpers
│   └── utils/
├── prisma/
│   ├── schema.prisma              # ER completo
│   └── seed.ts                    # datos demo La Brasa Dorada
├── .env.example
├── docker-compose.yml             # Postgres opcional para prod-like
├── package.json
├── tsconfig.json
└── README.md
```

---

## Endpoints principales

### Auth
- `POST /api/auth/login` `{ email, password }` → JWT
- `GET /api/auth/me`

### Mesas
- `GET /api/tables` (con filtros)
- `GET /api/tables/:id`
- `PATCH /api/tables/:id` ({ status, blocked, joinedWith, complaint, seats })
- `POST /api/tables/:id/call` ({ reason })
- `GET /api/tables/qr/:token` (público — identifica por QR)

### Menú
- `GET /api/menu/categories`
- `GET /api/menu/items?categoryId=&search=&available=true`
- `GET /api/menu/items/:id`
- `PATCH /api/menu/items/:id/availability` (cocina/admin)

### Órdenes
- `POST /api/orders` (crear)
- `GET /api/orders/:id`
- `GET /api/orders/active` (filtrado por rol)
- `PATCH /api/orders/:id` ({ priority, complaint })
- `POST /api/orders/:id/items` (agregar)
- `POST /api/orders/:orderId/items/:itemId/advance`
- `POST /api/orders/:id/checkout` ({ tipPct })
- `POST /api/orders/:id/bump`
- `GET /api/orders/:id/priority?explain=true`
- `GET /api/orders/priority/recommendation`

### Modificaciones
- `POST /api/orders/:orderId/items/:itemId/modifications` ({ reason, note })
- `PATCH /api/modifications/:id` ({ status, kitchenNote })
- `GET /api/modifications/pending`

### Llamados al mozo
- `GET /api/calls/active`
- `PATCH /api/calls/:id/resolve`

### Pago y comprobantes
- `POST /api/orders/:id/payment` ({ method, comprobante })
- `GET /api/comprobantes/:id`

### Reportes (admin)
- `GET /api/reports/dashboard`
- `GET /api/reports/sales?from=&to=&groupBy=hour|day`
- `GET /api/reports/top-items?limit=10`

### AI (opcional, requiere ANTHROPIC_API_KEY)
- `GET /api/ai/status`
- `GET /api/ai/explain-priority/:orderId`
- `GET /api/ai/suggest-sequence?station=brasa`
- `POST /api/ai/classify-complaint` ({ complaintText })
- `POST /api/ai/translate` ({ text, lang: en|pt|fr })
- `POST /api/ai/recommend` ({ cartItemNames })

---

## WebSocket

Cliente conecta con `Authorization: Bearer <token>` o `?qrToken=<>` (cliente público).

Rooms automáticos:
- `restaurant:{id}` — broadcast general
- `restaurant:{id}:role:{ROLE}` — por rol
- `restaurant:{id}:role:WAITER:{userId}` — mozo individual

Eventos servidor → cliente:
- `order:created`, `order:status`, `order:item:advanced`, `order:priority:changed`
- `modification:requested`, `modification:resolved`
- `call:created`, `call:resolved`
- `table:updated`, `table:complaint`
- `payment:processed`

---

## Smart Priority Algorithm

El motor está en `src/services/priority.service.ts`. Calcula score por orden combinando:

| Factor | Peso |
|---|---|
| Wait time (lineal hasta 10min, exponencial después) | 8/min → 18/min |
| Priority VIP (manual) | +250 |
| Priority HIGH (manual) | +120 |
| Queja activa | +200 |
| Course optimization (entrada → main >8min) | +90 |
| Course proactive (entrada → main >4min) | +40 |
| Mesa pequeña esperando | +25 |
| Bebidas pendientes >3min | +35 |

Tiers: `CRITICAL >=250`, `HIGH 130-249`, `MEDIUM 60-129`, `NORMAL <60`.

Recompute automático cada 30s vía cron interno.

---

## AI con Claude (opcional)

Para activar features de AI:

1. Conseguir API key de Claude en https://console.anthropic.com/
2. Agregar a `.env`:
   ```
   ANTHROPIC_API_KEY=tu-key-aqui
   AI_FEATURES_ENABLED=true
   ```
3. Reiniciar el servidor

Lo que hace el AI:
- **explainPriority** — convierte el score numérico en una explicación humana corta para el chef
- **suggestSequence** — sugiere orden óptimo de preparación dado el estado actual de una estación
- **classifyComplaint** — categoriza quejas y sugiere acción
- **translateMenu** — traduce descripciones del menú a inglés/portugués/francés
- **recommendForCustomer** — sugiere maridajes y complementos al cliente

Sin AI, el sistema sigue funcionando 100%: el motor determinístico es el source of truth, el AI solo enriquece.

---

## Producción

### Migrar a Postgres

```bash
# Levantar Postgres con docker-compose
docker compose up -d

# Editar .env
DATABASE_URL=postgresql://mesasmart:dev_password_change_me@localhost:5432/mesasmart

# Editar schema.prisma — cambiar provider de sqlite a postgresql
# Re-generar
npm run db:generate
npm run db:migrate
npm run db:seed
```

### Variables sensibles a configurar en producción

- `JWT_SECRET` — generar con `openssl rand -hex 64`
- `DATABASE_URL` — Postgres managed (Supabase, Neon, RDS)
- `NUBEFACT_TOKEN` — credencial OSE para emisión SUNAT
- `CULQI_PRIVATE_KEY` / `NIUBIZ_*` — pasarela de pago
- `RESEND_API_KEY` — emails transaccionales
- `S3_*` — almacenamiento de imágenes y PDFs
- `ANTHROPIC_API_KEY` — si se usa AI

### Despliegue mínimo

VPS Hetzner/DO 4GB · 2 vCPU + Cloudflare delante. PM2 o systemd para mantener el proceso vivo.

```bash
npm run build
NODE_ENV=production node dist/index.js
```

---

## Tests

```bash
npm test
```

(stubs en `tests/` — implementar suite completa antes de prod.)

---

## Comandos útiles

```bash
npm run dev              # hot reload
npm run db:studio        # UI visual de la BD
npm run db:reset         # rebuild desde cero
npm run db:seed          # repoblar
```
