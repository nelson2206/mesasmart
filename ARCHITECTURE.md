# MesaSmart · Arquitectura Técnica

Documento de arquitectura del backend y modelo de datos. Diseñado para escalar de un solo restaurante a una cadena multi-sede manteniendo simplicidad operativa.

---

## 1. Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| **Lenguaje backend** | TypeScript (Node.js 20+) | Tipado fuerte, ecosistema rico, fácil contratar |
| **Framework HTTP** | Express 4 | Simple, estable, sin acoplamiento innecesario |
| **ORM** | Prisma 5 | Migraciones declarativas, type-safe queries, excelente DX |
| **Base de datos** | PostgreSQL 16 (prod), SQLite (dev/demo) | PG para producción, SQLite para correr local sin Docker |
| **Real-time** | Socket.io 4 | WebSocket robusto con fallback, rooms por mesa/rol |
| **Validación** | Zod | Esquemas compartibles entre cliente y servidor |
| **Auth** | JWT + bcrypt | Stateless, escala horizontalmente |
| **Cache / colas** | Redis (opcional, prod) | Sesiones, rate limit, pub/sub multi-instancia |
| **Almacenamiento media** | S3 / R2 + CloudFront | Imágenes de platos, logos, comprobantes PDF |
| **Logs** | Pino | JSON estructurado, alto rendimiento |
| **Tests** | Vitest + Supertest | Rápido, integrado con TS |
| **Container** | Docker + docker-compose | Reproducibilidad |

### Por qué no NestJS

NestJS añade abstracciones (decorators, módulos, providers) útiles a >50K LoC pero pesadas para un MVP. Express + estructura modular en carpetas da el mismo resultado con menos boilerplate y curva de aprendizaje.

---

## 2. Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTE (Tablet)   COCINA (Pantalla)   ADMIN (Web)   MOZO  │
└──────────┬──────────────────┬──────────────┬─────────┬──────┘
           │                  │              │         │
           │            HTTPS │       HTTPS  │ HTTPS   │ HTTPS
           │           + WSS  │      + WSS   │ + WSS   │ + WSS
           │                  │              │         │
           └──────────────────┴──────┬───────┴─────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   API GATEWAY       │
                          │   (Nginx / CF)      │
                          └──────────┬──────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
        ┌─────────▼────────┐ ┌──────▼──────┐  ┌────────▼────────┐
        │  HTTP Layer      │ │  Socket.io  │  │  OSE Webhook    │
        │  (Express)       │ │  Server     │  │  (SUNAT)        │
        │  • Routes        │ │  • Rooms    │  │  • Callbacks    │
        │  • Middleware    │ │  • Auth     │  └────────┬────────┘
        │  • Validation    │ │  • Events   │           │
        └─────────┬────────┘ └──────┬──────┘           │
                  │                 │                  │
                  └────────┬────────┘                  │
                           │                           │
                  ┌────────▼────────────────────┐      │
                  │      SERVICE LAYER          │      │
                  │  • OrderService             │      │
                  │  • TableService             │◄─────┘
                  │  • KitchenService (priority)│
                  │  • PaymentService           │
                  │  • SunatService             │
                  │  • AuthService              │
                  └────────┬────────────────────┘
                           │
                  ┌────────▼────────┐
                  │   PRISMA ORM    │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐         ┌─────────────┐
                  │  PostgreSQL     │ ◄─────► │   Redis     │
                  │  (transactional)│         │  (cache)    │
                  └─────────────────┘         └─────────────┘
```

### Capas

1. **HTTP Layer** — Express routes, middleware (auth, rate-limit, CORS), Zod validation, error handling.
2. **Socket Layer** — Socket.io server con rooms por restaurante / mesa / rol. Auth via JWT.
3. **Service Layer** — Lógica de negocio pura, sin Express. Testeable en aislamiento.
4. **Data Layer** — Prisma ORM contra PostgreSQL. Transacciones para operaciones complejas.

---

## 3. Modelo de Datos (ER)

```
┌─────────────────┐         ┌──────────────────┐
│  Restaurant     │         │  User            │
├─────────────────┤  1   N  ├──────────────────┤
│ id (uuid) PK    │─────────│ id (uuid) PK     │
│ name            │         │ restaurantId FK  │
│ ruc             │         │ email            │
│ address         │         │ password_hash    │
│ ose_provider    │         │ role (enum)      │
│ ose_token       │         │ name             │
│ tax_rate        │         │ active           │
│ created_at      │         │ avatar_color     │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ 1                         │ 1
         │                           │
         │ N                         │ N
┌────────▼────────┐         ┌────────▼─────────┐         ┌──────────────────┐
│  Table          │         │  Order           │         │  MenuCategory    │
├─────────────────┤  1   N  ├──────────────────┤         ├──────────────────┤
│ id (uuid) PK    │◄────────│ id (uuid) PK     │         │ id (uuid) PK     │
│ restaurantId FK │         │ restaurantId FK  │         │ restaurantId FK  │
│ number (int)    │         │ tableId FK       │         │ name             │
│ x, y (grid pos) │         │ serverId FK      │         │ display_order    │
│ zone            │         │ status (enum)    │         │ active           │
│ seats           │         │ priority (enum)  │         └────────┬─────────┘
│ status (enum)   │         │ complaint        │                  │
│ blocked         │         │ complaint_at     │                  │ 1
│ blockedReason   │         │ created_at       │                  │
│ joinedWith FK   │         │ served_at        │                  │ N
│ complaint       │         │ closed_at        │         ┌────────▼─────────┐
│ qr_token        │         │ subtotal         │         │  MenuItem        │
└─────────────────┘         │ tax              │         ├──────────────────┤
                            │ tip              │         │ id (uuid) PK     │
                            │ total            │         │ categoryId FK    │
                            └────────┬─────────┘         │ name             │
                                     │                   │ description      │
                                     │ 1                 │ price_cents      │
                                     │                   │ image_url        │
                                     │ N                 │ prep_minutes     │
                            ┌────────▼─────────┐         │ kitchen_station  │
                            │  OrderItem       │  N    1 │ available        │
                            ├──────────────────┤◄────────│ tags (json)      │
                            │ id (uuid) PK     │         │ spicy            │
                            │ orderId FK       │         │ calories         │
                            │ menuItemId FK    │         └──────────────────┘
                            │ qty              │
                            │ notes            │
                            │ course           │
                            │ kitchen_status   │         ┌──────────────────┐
                            │ priority_score   │  1    N │ ModificationReq  │
                            │ received_at      │◄────────├──────────────────┤
                            │ preparing_at     │         │ id (uuid) PK     │
                            │ ready_at         │         │ orderItemId FK   │
                            │ served_at        │         │ requested_by     │
                            │ price_cents      │         │ reason (enum)    │
                            └──────────────────┘         │ note             │
                                                         │ status (enum)    │
                                                         │ kitchen_note     │
                                                         │ resolved_at      │
                                                         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Call (Mozo)     │         │  Comprobante     │         │  Payment         │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ id (uuid) PK     │         │ id (uuid) PK     │         │ id (uuid) PK     │
│ tableId FK       │         │ orderId FK U     │         │ orderId FK U     │
│ reason           │         │ type (B/F/T)     │         │ method (enum)    │
│ urgent           │         │ serie            │         │ amount_cents     │
│ status           │         │ correlativo      │         │ tip_cents        │
│ created_at       │         │ ruc_cliente      │         │ status           │
│ resolved_by FK   │         │ razon_social     │         │ external_id      │
│ resolved_at      │         │ subtotal         │         │ created_at       │
└──────────────────┘         │ igv              │         │ confirmed_at     │
                             │ total            │         └──────────────────┘
                             │ xml_url          │
                             │ pdf_url          │
                             │ cdr_url          │
                             │ ose_status       │
                             │ ose_hash         │
                             │ created_at       │
                             └──────────────────┘
```

### Enums clave

| Enum | Valores |
|---|---|
| `UserRole` | ADMIN · CASHIER · WAITER · KITCHEN |
| `TableStatus` | FREE · OCCUPIED · BILLING · CLEANING · RESERVED · BLOCKED |
| `OrderStatus` | OPEN · KITCHEN · SERVED · BILLING · PAID · VOID |
| `OrderPriority` | NORMAL · HIGH · VIP |
| `OrderItemStatus` | RECEIVED · PREPARING · READY · SERVED · CANCELLED |
| `ItemCourse` | DRINKS · STARTER · MAIN · SIDE · DESSERT |
| `ModReason` | CANCEL · QTY · INGREDIENTS · COOKING · SWAP · OTHER |
| `ModStatus` | PENDING · ACCEPTED · REJECTED · CANCELLED |
| `PaymentMethod` | YAPE · PLIN · CARD · CASH · TRANSFER |
| `ComprobanteType` | BOLETA · FACTURA · TICKET |

### Decisiones de diseño

- **price_cents** (entero) en vez de decimal para evitar floats en cálculos. Convertir en API layer.
- **JSON columns** solo para tags y reservas (opcionales), no para data crítica.
- **Soft delete** vía `active: false` o `closed_at`, no hard delete (auditoría).
- **UUIDs** en vez de auto-increment para evitar enumeración.
- **Multi-tenant** por columna `restaurantId` en cada entidad principal — escalable hasta 10k restaurantes; row-level security a nivel app.

---

## 4. API REST

Todas las rutas requieren `Authorization: Bearer <jwt>` excepto `auth/*` y health.

### Auth
- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `POST /api/auth/refresh` → nuevo token
- `GET /api/auth/me` → user actual

### Mesas
- `GET /api/tables?zone=&status=` → lista
- `GET /api/tables/:id` → detalle con orden activa
- `PATCH /api/tables/:id` `{ status?, blocked?, blockedReason?, joinedWith?, complaint?, seats? }`
- `POST /api/tables/:id/call` `{ reason }` → registra llamado al mozo
- `POST /api/tables/qr/:token` → identifica mesa por QR (público)

### Menú
- `GET /api/menu/categories`
- `GET /api/menu/items?categoryId=&search=&dietary=`
- `GET /api/menu/items/:id`
- `POST /api/menu/items` (admin)
- `PATCH /api/menu/items/:id` (admin)
- `PATCH /api/menu/items/:id/availability` `{ available }` (admin/cocina cuando se acaba)

### Órdenes
- `POST /api/orders` `{ tableId, items:[{menuItemId, qty, notes, course}] }` → crea ticket
- `GET /api/orders/:id` → detalle completo
- `GET /api/orders/active?role=KITCHEN|WAITER` → filtrado por rol
- `PATCH /api/orders/:id` `{ priority?, complaint?, status? }`
- `POST /api/orders/:id/items` agrega items (segunda ronda)
- `POST /api/orders/:id/items/:itemId/advance` → mueve a siguiente estado
- `POST /api/orders/:id/items/:itemId/serve` → marca servido
- `POST /api/orders/:id/checkout` `{ tip_pct }` → cierra y calcula
- `GET /api/orders/:id/priority` → score Smart Priority + razones

### Modificaciones
- `POST /api/orders/:orderId/items/:itemId/modifications` `{ reason, note }`
- `PATCH /api/modifications/:id` `{ status: ACCEPTED|REJECTED, kitchenNote }`

### Llamados
- `GET /api/calls/active` → llamados pendientes
- `PATCH /api/calls/:id/resolve`

### Pago y comprobante
- `POST /api/orders/:id/payment` `{ method, comprobante: { type, doc, name, address, email } }`
- `GET /api/comprobantes/:id` → metadata + URLs PDF/XML/CDR
- `POST /api/comprobantes/:id/email` → reenvía por email

### Reportes (admin)
- `GET /api/reports/sales?from=&to=&groupBy=hour|day`
- `GET /api/reports/top-items?from=&to=&limit=10`
- `GET /api/reports/server-performance`

---

## 5. Eventos WebSocket

### Rooms
Cada cliente entra a rooms según su rol:
- `restaurant:{id}` — todos los del restaurante
- `restaurant:{id}:role:KITCHEN` — solo cocina
- `restaurant:{id}:role:WAITER` — solo mozos
- `restaurant:{id}:role:WAITER:{userId}` — mozo individual
- `restaurant:{id}:table:{tableNumber}` — cliente en su mesa
- `restaurant:{id}:order:{orderId}` — siguiendo una orden

### Eventos servidor → cliente

| Evento | Payload | Receptores |
|---|---|---|
| `order:created` | `{ orderId, tableNumber, items[] }` | KITCHEN, WAITER:{server}, ADMIN |
| `order:item:advanced` | `{ orderId, itemId, status }` | order:{id}, KITCHEN, WAITER, ADMIN |
| `order:status` | `{ orderId, status }` | order:{id}, role:* |
| `order:priority:changed` | `{ orderId, priority, score, reasons }` | KITCHEN, ADMIN |
| `modification:requested` | `{ modId, orderId, itemId, reason, note }` | KITCHEN, WAITER:{server} |
| `modification:resolved` | `{ modId, status, kitchenNote }` | order:{id}, WAITER:{server} |
| `call:created` | `{ callId, tableNumber, reason }` | WAITER:{assigned}, ADMIN |
| `call:resolved` | `{ callId }` | room:restaurant |
| `table:updated` | `{ tableId, fields }` | role:WAITER, ADMIN |
| `table:complaint` | `{ tableId, reason }` | KITCHEN, ADMIN |
| `payment:processed` | `{ orderId, comprobanteUrl }` | order:{id}, CASHIER |

### Eventos cliente → servidor

| Evento | Payload |
|---|---|
| `subscribe:role` | `{ role }` — entra a su room |
| `subscribe:order` | `{ orderId }` — sigue una orden |
| `subscribe:table` | `{ tableNumber }` — para cliente |
| `kitchen:advance` | `{ orderId, itemId }` |
| `kitchen:bump` | `{ orderId }` |
| `waiter:resolve-call` | `{ callId }` |

---

## 6. Smart Priority Algorithm

Función pura en `services/priority.service.ts`. Calcula score por orden y devuelve razones.

```ts
calcPriority(order, context): {
  score: number
  tier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL'
  reasons: { code, text, weight }[]
}
```

### Pesos (tunables vía config)

| Factor | Peso | Lógica |
|---|---|---|
| Wait time | linear → exponencial >10min | `min(80, t*8) + max(0, (t-10)*18)` |
| `priority = VIP` | +250 | Boost máximo manual |
| `priority = HIGH` | +120 | Boost manual moderado |
| `complaint` | +200 | Queja activa siempre cerca del top |
| Course optimization | +40 a +90 | Si pasaron >4 min desde entrada y hay main pendiente |
| Mesa pequeña (≤2) > 6 min | +25 | Parejas y solos esperan menos |
| Drinks pendientes > 3 min | +35 | Las bebidas deben salir rápido |

### Tiers
- ≥ 250: CRITICAL (rojo, parpadea)
- 130-249: HIGH (ámbar)
- 60-129: MEDIUM (azul)
- < 60: NORMAL (gris)

### Recompute
- Cada 30 segundos vía cron interno
- Bajo demanda al cambiar estado de items o priority/complaint
- Persiste `priority_score` para indexar y ordenar en BD

---

## 7. Integración SUNAT (OSE)

Operador de Servicios Electrónicos: usamos **Nubefact** por simplicidad (también soporta Efact, SUNAT directo).

### Flujo
1. Cliente confirma pago → backend crea `Comprobante` en estado `PENDING`.
2. Service genera UBL 2.1 XML firmado con certificado del restaurante.
3. POST a Nubefact API → respuesta sincrónica con CDR.
4. Si OK → estado `ACCEPTED`, guarda XML/PDF/CDR en S3.
5. Webhook async opcional para reintentos.
6. Email al cliente con PDF adjunto.

### Variables de entorno

```
NUBEFACT_API_URL=https://api.nubefact.com/api/v1/...
NUBEFACT_TOKEN=...
NUBEFACT_RESTAURANT_RUC=20512345678
SUNAT_BOLETA_SERIE=B001
SUNAT_FACTURA_SERIE=F001
```

### Mock en desarrollo
`SunatService` tiene flag `MOCK_OSE=true` que simula respuesta exitosa con QR generado e incrementa correlativo en BD.

---

## 8. Seguridad

- **HTTPS obligatorio** en producción. Let's Encrypt vía Caddy/Nginx.
- **JWT** corto (15 min) + refresh token (7 días) en httpOnly cookie.
- **Rate limiting** por IP: 60 req/min en endpoints públicos, 200 req/min autenticados.
- **CORS** estricto: solo dominio del frontend.
- **Helmet.js** para headers de seguridad.
- **bcrypt** rounds 12 en passwords.
- **Validación Zod** en TODA entrada del usuario.
- **SQL injection** evitado por Prisma (queries parametrizadas).
- **XSS** evitado por React escapando por defecto.
- **CSRF** mitigado con SameSite cookies + tokens en formularios sensibles.
- **Audit log** de cambios críticos (precios, comprobantes anulados, accesos admin).
- **Datos personales** (Ley 29733): consentimiento explícito, derecho de eliminación, encriptación at-rest.

---

## 9. Despliegue

### Producción mínima viable
- 1 VPS (Hetzner, DigitalOcean): 4 GB RAM, 2 vCPU
- Postgres managed (Supabase, Neon) o en el mismo VPS
- Object storage: Cloudflare R2 (gratis hasta 10GB) o S3
- Cloudflare delante para CDN, DDoS protection, SSL

### Producción cadena (multi-sede)
- Kubernetes (k3s o EKS) — 3 nodos
- Postgres con réplicas
- Redis cluster para Socket.io adapter (multi-instancia)
- Observabilidad: Grafana Cloud (logs, métricas, traces)

### CI/CD
- GitHub Actions: lint → test → build → deploy
- Migraciones Prisma automáticas en deploy
- Healthchecks `/health` y `/health/db`
- Blue/green deployment para zero downtime

---

## 10. Decisiones futuras

| Cuándo | Decisión |
|---|---|
| > 50 restaurantes | Migrar Socket.io a Redis adapter, sharding de BD por región |
| > 10K órdenes/día | Queue (BullMQ) para SUNAT y emails (no bloquear request) |
| Multi-país | Strategy pattern para impuestos y comprobantes (Chile boleta, etc.) |
| AI predictivo real | ML model de tiempos de prep basado en histórico (entrenar en BigQuery) |
| Marketplace delivery | Webhook de PedidosYa/Rappi con normalización a OrderItem |

---

## 11. Estructura del repositorio

```
backend/
├── src/
│   ├── index.ts                  # entry point
│   ├── prisma.ts                  # PrismaClient singleton
│   ├── config/
│   │   └── env.ts                 # validated env
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── error.ts
│   │   └── rateLimit.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── menu.routes.ts
│   │   ├── tables.routes.ts
│   │   ├── orders.routes.ts
│   │   ├── modifications.routes.ts
│   │   ├── calls.routes.ts
│   │   └── payments.routes.ts
│   ├── services/
│   │   ├── order.service.ts
│   │   ├── priority.service.ts   # Smart Priority
│   │   ├── kitchen.service.ts
│   │   ├── sunat.service.ts
│   │   └── auth.service.ts
│   ├── sockets/
│   │   ├── index.ts
│   │   └── events.ts
│   └── utils/
│       ├── money.ts
│       └── ids.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   └── *.test.ts
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── README.md
```
