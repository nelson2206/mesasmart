# 📊 MesaSmart · Mapeo de funcionalidades

**Última actualización:** 2 de mayo de 2026
**Versión actual:** Backend en Render · Frontend en GitHub Pages

---

## Leyenda

| Estado | Significado |
|---|---|
| ✅ | Construido y funcionando |
| 🟡 | Construido parcial (mock, sin integración real, o solo schema) |
| ❌ | No construido |
| 🔮 | Eliminado del scope (post-cleanup honesto) |

---

## 1️⃣ Plan original (antes de la llamada con el experto)

> **Tesis original:** Tablet-first. App de pedidos en mesa con backend POS.

### Frontend · vistas operativas

| Funcionalidad | Estado | Notas |
|---|---|---|
| Hub launcher de roles (`index.html`) | ✅ | Con catálogo visual + consultor IA + 3 plan cards |
| Vista cliente · tablet en mesa (`cliente.html`) | ✅ | Carta foto-first, carrito, modificaciones, checkout, multi-idioma |
| Vista cocina KDS (`cocina.html`) | ✅ | Tickets en vivo, color por edad, routing por estación, bump system |
| Vista mozo móvil (`mozo.html`) | ✅ | Floor plan, llamados, tomar pedido, asistente IA |
| Vista admin (`admin.html`) | ✅ | Dashboard, mesas, pedidos, reportes, personal, ajustes, cola IA |
| Vista ERP (`erp.html`) | ✅ | Inventario, conversiones, recetas, P&L, campañas, plan |
| Login (`login.html`) | ✅ | Diseño premium |

### Backend · core POS

| Funcionalidad | Estado | Notas |
|---|---|---|
| Node.js + TypeScript + Express + Prisma | ✅ | Deploy en Render |
| PostgreSQL (Render Postgres) | ✅ | Schema completo, idempotent seed |
| Multi-tenant por `restaurantId` | ✅ | En todas las queries |
| JWT auth (login/refresh) | ✅ | Roles: ADMIN/CASHIER/WAITER/KITCHEN |
| Socket.io tiempo real | ✅ | Rooms por `restaurantId` |
| API mesas/órdenes/pagos/menú | ✅ | CRUD completo |
| Modificaciones de pedido | ✅ | Schema `ModificationRequest` |
| Llamados al mozo | ✅ | Schema `Call`, real-time |
| Smart Priority cocina (algoritmo rule-based) | ✅ | `priority.service.ts`, recompute cada 30s |

### Pagos peruanos & SUNAT

| Funcionalidad | Estado | Notas |
|---|---|---|
| Yape · Plin · Tarjeta · Efectivo (UI) | ✅ | Métodos en checkout |
| Yape/Plin gateway real | ❌ | Solo mock — falta integración con MoneyClick / Niubiz / Yape Empresa |
| Boleta/Factura SUNAT (UI) | ✅ | Generación visual, series B001/F001 |
| OSE real (Nubefact) | 🟡 | Schema preparado (`oseProvider`, `oseToken`), MOCK_OSE flag, falta envío real UBL 2.1 |
| Comprobante con CDR | 🟡 | Schema lista, no se firma ni envía |
| Libro de Reclamaciones INDECOPI | 🟡 | Mock en UI, sin integración real |
| Reporte SUNAT mensual ZIP | ❌ | No implementado |

### Customer-facing UX

| Funcionalidad | Estado | Notas |
|---|---|---|
| Modificación de plato | ✅ | Solicitud al mozo desde cliente |
| Pedidos juntos vs por curso | ✅ | Selector "serving order" en checkout |
| QR token por mesa | ✅ | Schema `qrToken` |
| Multi-idioma (es/en/pt) | 🟡 | Solo welcome screen, no traducción completa |

---

## 2️⃣ Pivote post-experto (Mauricio · ERP-first)

> **Tesis nueva:** El cliente no necesita tablet, necesita un ERP que reemplace InfoRes. Conversiones de insumos es la pieza diferenciadora.

### Modelo de planes & feature flags

| Funcionalidad | Estado | Notas |
|---|---|---|
| 4 planes modulares definidos (POS_SOLO/OPERACION/PROFESIONAL/ENTERPRISE) | ✅ | en `assets/features.js` |
| Plan POS_SOLO eliminado | ✅ | No queremos competir en commodity |
| Catálogo visual de planes en hub | ✅ | 3 plan cards + matriz filtrable + filtros por grupo |
| Wizard consultor IA (5 pasos) | ✅ | Recomienda plan según locales/comensales/menú/dolores |
| Step 5 wizard rediseñado | ✅ | Hero card con gradient por plan, fit bar, CTAs |
| `RestaurantPlan` schema (toggles por módulo) | ✅ | `pos`/`inventory`/`transformations`/`pnl`/etc |
| Feature gates con `data-feature` | ✅ | features.js auto-aplica lock cards |
| MutationObserver para gates en React | ✅ | Auto-detecta nuevos componentes montados |
| Persistencia del plan activo (localStorage) | ✅ | `mesasmart_active_plan` |

### Conversiones de insumos (la cereza vs InfoRes)

| Funcionalidad | Estado | Notas |
|---|---|---|
| `IngredientTransformation` schema | ✅ | from→to + yieldPct + laborMinutes/Cost + station |
| `TransformationExecution` (ejecuciones reales) | ✅ | Para detectar variance vs yield esperado |
| `Ingredient.level` (RAW/INTERMEDIATE/PREPARED) | ✅ | Tipología de insumos |
| Routes `/api/transformations/*` | ✅ | List, yields report, create, execute |
| UI Conversiones en ERP | ✅ | Vista lista + ejecución |
| Seed con 6 transformaciones demo | ✅ | Pescado entero→fileteado, pollo→trozado, lomo→limpio |
| Endpoint admin backfill | ✅ | `/api/admin/backfill/transformations` para clientes ya seedeados |

### Recepción de guías con foto IA

| Funcionalidad | Estado | Notas |
|---|---|---|
| `GoodsReceipt` + `GoodsReceiptLine` schema | ✅ | Vinculado a Supplier + opcional PO |
| Guide URL y status workflow | ✅ | PENDING_REVIEW / CONFIRMED / DISCREPANCY |
| Vista UI en ERP | ✅ | Mockup con upload de foto |
| Claude Vision OCR real | 🟡 | Servicio existe pero usando mock por defecto |
| Match automático de items con `Ingredient` | 🟡 | Lógica existe, sin training fine |

### Personal y nómina (Perú)

| Funcionalidad | Estado | Notas |
|---|---|---|
| `User` extendido (position, contractType, salario, dni, hiredAt) | ✅ | Schema completo |
| `Restaurant.laborOverheadPct` (40% Perú) | ✅ | ESSALUD 9% + grats 16.67% + CTS 8.33% + vacaciones |
| Routes `/api/personnel/*` | ✅ | List, get, create, patch, cost-summary |
| UI Personal en admin | ✅ | Lista de empleados, edición, sueldos |
| P&L incluye costo laboral + EBITDA | ✅ | `pnl.service.ts` extendido |
| Seed con 10 empleados (sueldos peruanos reales) | ✅ | S/1100 mozo, S/3800 chef, etc |

### Cliente recurrente & rewards

| Funcionalidad | Estado | Notas |
|---|---|---|
| `Customer` schema | ✅ | dni, email, phone, totalVisits, totalSpentCents, tier |
| Endpoints públicos identify/register-visit/apply-reward | ✅ | Sin auth, usa qrToken |
| `computeCustomerTier()` | ✅ | NEW / RETURNING (3+) / FREQUENT (10+) / VIP (20+) |
| UI CustomerIdentifyModal en cliente.html | ✅ | 3-step flow |
| Pill de bienvenida con tier | ✅ | En welcome screen |

### Auditoría

| Funcionalidad | Estado | Notas |
|---|---|---|
| `AuditLog` schema | ✅ | userId, action, entityType, before/after JSON, reason |
| Routes `/api/audit/*` | ✅ | Listado filtrable por entityType, restaurantId |
| Auto-log en personnel.routes.ts | ✅ | Cuando se cambia un empleado |
| UI viewer en admin/erp | ❌ | Solo backend |

### Multi-local

| Funcionalidad | Estado | Notas |
|---|---|---|
| Vista multi-local consolidado (`multi.html`) | ✅ | KPIs sumados, grid de cards, comparativo, matriz de permisos |
| Switcher de restaurante activo en cada vista | ✅ | Pill flotante en admin/mozo/erp/cliente/cocina |
| Persistencia restaurante activo (localStorage) | ✅ | `mesasmart_active_restaurant` |
| Demo de 4 locales + 8 usuarios con roles diferenciados | ✅ | Mock en `features.js` |
| Backend real multi-restaurante por usuario | ❌ | Hoy User → Restaurant 1:1, falta `UserRestaurantAccess` join |
| `RestaurantGroup` / Holding model | ❌ | No existe schema |
| Multi-RUC consolidado real | ❌ | Cada restaurant tiene su RUC pero falta concepto de grupo |

### Implementadores certificados (partners)

| Funcionalidad | Estado | Notas |
|---|---|---|
| `Partner` + `PartnerCommission` schema | ✅ | Comisiones monthlyPct/setupPct, status |
| Página `partners.html` | ✅ | Hero, beneficios, 3 tiers (Bronze/Silver/Gold), flow, requisitos, CTA |
| Routes `/api/partners/*` | ❌ | Schema lista, no hay endpoints |
| Portal de partner (ver sus clientes/comisiones) | ❌ | UI no existe |
| Email automatizado de pago de comisiones | ❌ | No implementado |

---

## 3️⃣ Faltantes críticos (post-cleanup honesto)

### Backend que necesita refactor de schema

| Funcionalidad | Prioridad | Notas |
|---|---|---|
| `UserRestaurantAccess` (usuario → muchos restaurantes con roles distintos) | 🔥 ALTA | Hoy User es 1:1 con Restaurant. Profesional necesita 1:N |
| `RestaurantGroup` / Holding model | 🔥 ALTA | Para reportes consolidados multi-RUC |
| `RestaurantTransfer` (transferencias entre locales) | MEDIA | InventoryMovement type=TRANSFER existe pero falta lógica end-to-end |
| `MultiRestaurantPurchaseOrder` | MEDIA | 1 PO con líneas asignables a varios restaurantes |
| Customer compartido entre locales del mismo grupo | MEDIA | Hoy `@@unique([restaurantId, dni])` lo aísla |

### Integraciones reales (crítico para producción)

| Funcionalidad | Prioridad | Notas |
|---|---|---|
| OSE Nubefact (envío real UBL 2.1) | 🔥 ALTA | Sin esto no podemos emitir comprobantes legales |
| Pasarela de pagos real (Niubiz, Culqi, Mercado Pago) | 🔥 ALTA | Hoy todo es mock |
| Yape Empresa / Plin merchant | 🔥 ALTA | Para cobros QR reales |
| Anthropic Claude API (producción con API key real) | 🟡 MEDIA | Hoy hay servicio pero usa mock o key dev |
| INDECOPI Libro de Reclamaciones digital | MEDIA | Compliance ley peruana |
| Email transaccional (SendGrid/Postmark) | MEDIA | Para boletas, recibos, alertas |
| WhatsApp Business API | BAJA | Para llegar al cliente final con campañas |

### Operación comercial / billing

| Funcionalidad | Prioridad | Notas |
|---|---|---|
| Sistema de billing recurrente (Stripe/Culqi) | 🔥 ALTA | Para cobrar S/199/399/1499 mensual |
| Self-service signup + onboarding wizard | 🔥 ALTA | Hoy todo es por seed manual |
| Trial gratuito de 14 días | ALTA | Modelo SaaS estándar |
| Invitaciones de usuarios por email | ALTA | Para que el dueño invite a su staff |
| Recovery de password | ALTA | No existe flow |
| Página de status / mantenimientos | BAJA | Para confianza |
| Cancelación / pausa de cuenta self-service | MEDIA | |

### UX/UI faltantes

| Funcionalidad | Prioridad | Notas |
|---|---|---|
| Wizard de setup inicial post-signup | 🔥 ALTA | Crear restaurante, importar menú, agregar staff |
| Importación masiva inventario (Excel/CSV) | ALTA | Crítico para onboarding |
| Importación masiva menú | ALTA | |
| Viewer de audit log en UI | MEDIA | Schema lista, falta vista |
| Dashboard de partner | MEDIA | Comisiones, leads asignados, clientes |
| Vista de reportes históricos descargables (PDF) | MEDIA | P&L mensual export |
| App móvil del dueño (PWA) | BAJA | Hoy solo web |

### Compliance / legal Perú

| Funcionalidad | Prioridad | Notas |
|---|---|---|
| Términos y condiciones / Política de privacidad | ALTA | Antes de cobrar |
| Ley 29733 PDP (protección datos personales) | ALTA | Encriptación, exportación, derecho al olvido |
| Cumplimiento RS 097-2012 SUNAT (boletas) | 🟡 | Schema OK, integración pendiente |
| Backups encriptados con retención 7 años | MEDIA | Reglamento contable peruano |
| 2FA para roles ADMIN | MEDIA | |

---

## 4️⃣ Eliminado del scope (post-cleanup)

Estos los inventé en una versión anterior y no estaban en plan. Los retiré:

| Feature | Estado |
|---|---|
| Forecast de demanda IA | 🔮 Eliminado |
| Optimización de turnos IA | 🔮 Eliminado |
| Menu engineering IA | 🔮 Eliminado |
| Detección de anomalías IA | 🔮 Eliminado |
| IA fine-tuned por marca | 🔮 Eliminado |
| SSO SAML/OIDC | 🔮 Eliminado |
| Roles granulares por campo | 🔮 Eliminado |
| IP allowlist | 🔮 Eliminado |
| SLA 99.9% contractual | 🔮 Eliminado |
| White-label opcional | 🔮 Eliminado |
| Ambiente dedicado | 🔮 Eliminado |
| API REST + Webhooks abiertos | 🔮 Eliminado |
| Export a Concar / SAP / Siigo | 🔮 Eliminado |
| Conector Power BI / Tableau | 🔮 Eliminado |
| Conciliación bancaria automática | 🔮 Eliminado |
| Integración Rappi / PedidosYa | 🔮 Eliminado |
| Integración CRM externo (HubSpot etc) | 🔮 Eliminado |
| Customer Success Manager dedicado | 🔮 Eliminado |
| Quarterly business review | 🔮 Eliminado |
| Capacitación recurrente | 🔮 Eliminado |
| Cocina central / commissary | 🔮 Eliminado |
| P&L consolidado holding | 🔮 Eliminado (queda implícito en multi.html) |
| Reportes ejecutivos al directorio | 🔮 Eliminado |

---

## 5️⃣ Resumen ejecutivo

### Estado actual

| Categoría | Status |
|---|---|
| **Frontend de las 6 vistas** (cliente, mozo, cocina, admin, erp, multi) | ✅ Completo a nivel demo |
| **Backend POS core** (auth, mesas, pedidos, cocina, pagos) | ✅ Funcional |
| **ERP module** (inventario, recetas, conversiones, suppliers, P&L, costos laborales) | ✅ Funcional |
| **Multi-tenant por restaurante** | ✅ |
| **Multi-local consolidado** (frontend) | ✅ |
| **Multi-local por usuario con roles diferenciados** (backend) | ❌ Falta refactor |
| **Cumplimiento SUNAT real** (envío UBL a OSE) | 🟡 Mock |
| **Pagos reales** (Yape/Plin/tarjeta) | ❌ Mock |
| **Billing recurrente** | ❌ |
| **Self-service signup** | ❌ |

### % de completitud por área

```
Vistas operativas:     ████████████████████ 100%   (6/6 vistas)
Backend POS:           ████████████████████ 100%   (auth, mesas, pedidos, kds)
ERP:                   ██████████████████░░  90%   (falta UI de audit log)
Conversiones:          ████████████████████ 100%   (la cereza)
Personal/Nómina:       ████████████████████ 100%
Customer recurrente:   ████████████████████ 100%
Multi-local frontend:  ████████████████████ 100%
Multi-local backend:   ████░░░░░░░░░░░░░░░░  20%   (falta UserRestaurantAccess)
Pagos reales:          ██░░░░░░░░░░░░░░░░░░  10%   (mock)
SUNAT real:            ████░░░░░░░░░░░░░░░░  20%   (schema OK, no envía)
Billing/SaaS ops:      ░░░░░░░░░░░░░░░░░░░░   0%   (todo manual)
Partners (operativo):  ████████░░░░░░░░░░░░  40%   (página + schema, falta portal y endpoints)
```

### Ruta crítica para llegar a primer cliente pagante

1. **Self-service signup + onboarding wizard** — sin esto, cada cliente requiere 4h de seed manual
2. **Billing recurrente con Culqi** — para cobrar S/199 mensuales sin tocar nada
3. **OSE Nubefact real** — sin comprobantes legales no podemos operar
4. **UserRestaurantAccess refactor** — para que un dueño con 2 locales tenga UNA cuenta
5. **Portal de partner** — para activar el canal de implementadores
6. **Importación masiva de menú/inventario** — sin esto onboarding es muy lento

---

*Este documento se actualiza cada vez que cambia el scope. Mantenerlo al día.*
