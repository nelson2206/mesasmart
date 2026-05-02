# 🔍 QA Diagnóstico · MesaSmart

**Fecha:** 2 de mayo de 2026
**Alcance:** 9 vistas frontend + 22 archivos de routes backend + servicios + sockets + schema
**Método:** Auditoría estática exhaustiva de cada botón, handler, endpoint y wiring

---

## 📊 Score general

| Área | Total | OK | Issues | Coverage |
|---|---|---|---|---|
| **Frontend** (botones/handlers) | 159 | 114 | 45 | **72%** |
| **Backend** (endpoints) | 65+ | 60 | 5 críticos · 12 menores | **85%** |
| **Frontend ↔ features.js** consistencia | 9/9 | 9 | 0 | **100%** |
| **TOTAL ESTIMADO** | — | — | — | **~78%** |

**Veredicto:** App navegable y demo-ready. **No production-ready** sin atender los 3 P0 de backend (pagos / SUNAT / transacciones atómicas) y los 2 P0 de frontend (cobro en admin / conteo en ERP).

---

## 🔴 P0 · Bloqueantes (ANTES de cobrar a primer cliente)

### Backend

1. **Pagos en mock**
   `backend/src/routes/payments.routes.ts:97-99`
   `processRealPayment()` siempre devuelve `${method}_LIVE_${Date.now()}` — no integra con Culqi/Niubiz/Yape Empresa.
   **Fix:** Integrar SDK Culqi (Lima) o Niubiz. Mínimo: rechazar si faltan credenciales.

2. **SUNAT/OSE comprobantes ficticios**
   `backend/src/services/sunat.service.ts:100-152`
   Genera PDF/XML mock. No firma UBL 2.1 ni envía a Nubefact.
   **Fix:** Integrar Nubefact SDK o equivalente. Requerir certificado digital del cliente.

3. **Race conditions en flujos críticos**
   - `payments.routes.ts:40-75` — payment + comprobante NO atómicos
   - `orders.routes.ts:161-191` — advance + deducción de inventario NO atómicos
   - `sunat.service.ts:66-68` — incrementa serie ANTES de OSE confirm
   **Fix:** envolver en `prisma.$transaction()`.

### Frontend

4. **admin.html:786-787 — "Ver pedido" y "Cobrar" son stubs**
   El cierre de mesa no funciona. Imposible operar.
   **Fix:** Implementar modal de detalle de pedido + flujo de cobro real.

5. **erp.html:563, 968, 1001, 1026 — Conteo de inventario inoperante**
   5 botones del flujo de conteo físico son stubs.
   **Fix:** Implementar guardar/completar/descartar conteo con llamadas al backend.

6. **index.html:1842 + admin.html:1842 — "Activar este plan" sin handler**
   El CTA principal del wizard no hace nada. (Actualización: ya tiene `onclick` programático en `showRecommendation`, pero el `href="#"` salta al top de la página antes de ejecutar. Requiere `event.preventDefault()`.)
   **Fix:** Verificar que el handler corra y bloquee la navegación.

---

## 🟡 P1 · Importantes (antes de beta abierto)

### Backend

7. **Modifications POST sin auth** (`modifications.routes.ts:15`)
   Cualquiera puede pedir modificaciones de cualquier orden.
   **Fix:** `authRequired` o validación vía qrToken.

8. **Socket.io `subscribe:table` sin validar qrToken** (`sockets/index.ts:68`)
   Cliente con qrToken A puede escuchar mesa B.
   **Fix:** Pasar qrToken en subscribe y verificar match con la tabla solicitada.

9. **AI fallback silencioso** (`services/ai.service.ts`)
   Sin `ANTHROPIC_API_KEY` regresa heurísticas rule-based sin avisar al usuario.
   **Fix:** Header `X-AI-Source: claude|fallback` en respuestas + indicar en UI.

10. **JWT_SECRET min 16 chars es débil** (`config/env.ts:10`)
    **Fix:** subir a `min(32)`.

### Frontend

11. **admin.html:348, 352, 527, 572, 786-787, 878, 887** — 7 stubs genéricos en panel admin
    "Función disponible próximamente" en interacciones primarias.
    **Fix:** Priorizar y implementar uno por uno o quitar el botón.

12. **erp.html:460, 471, 526, 563** — 4 stubs en alertas y agregar ingredientes
    **Fix:** Implementar filtros y modal de "agregar ingrediente".

13. **multi.html:686 — "Invitar usuario" lanza alert**
    Necesario para multi-local funcional.
    **Fix:** Modal de invitación + endpoint `/api/team/invite` (no existe aún).

14. **mozo.html:236 — Botón flotante stub**
    **Fix:** Implementar o remover.

---

## 🟠 P2 · Mejoras (sprint siguiente)

### Backend

15. **Recipes DELETE sin validación restaurantId** (`recipes.routes.ts:82-88`)
    **Fix:** filtro `where: { menuItem: { category: { restaurantId } } }`.

16. **Menu GET endpoints públicos** (`menu.routes.ts:11, 24, 52`)
    Riesgo de enumeration. Aceptar `?restaurantId=X` sin validar.
    **Fix:** Validar que el restaurante existe y está activo.

17. **Tables POST `/call` sin validación restaurantId** (`tables.routes.ts:80-104`)
    **Fix:** join con restaurant.

18. **Photo AI: imageBase64.min(100)** muy bajo (`inventory.routes.ts:90-117`)
    **Fix:** subir a `.min(1000)` o validar magic bytes.

19. **N+1 potencial en `/api/orders/active`** y `/api/recipes/coverage`
    **Fix:** Monitorear con APM en prod, refactor si > 500ms.

### Frontend

20. **cocina.html:406, 409 — Botones imprimir/ajustes sin onClick**
    **Fix:** Implementar o remover.

21. **login.html:1843 — número WhatsApp `51999999999` placeholder**
    **Fix:** Reemplazar con número real comercial.

22. **erp.html: 27 stubs (43% coverage)** — la vista más incompleta
    Esto es trabajo de varios días. Priorizar conteo (P0), después alertas, agregar ingrediente, etc.

---

## 🔵 P3 · Deuda técnica (no urgente)

23. **Hardcoded `marginPct: 65`** en `campaigns.routes.ts:62` en lugar de calcular real.
24. **No hay correlation ID** en logs (utils/logger.ts).
25. **Socket.io sin rate limit** (sockets/index.ts).
26. **Inventory weighted avg cost** se distorsiona si stock llega a 0 (inventory.service.ts:135-145).
27. **Schema MenuItem.popular y .recommended** referenciados en código pero no existen en schema.

---

## ✅ Lo que está sólido

**Backend:**
- Auth (login, /me, JWT, bcrypt) — sin tachas
- Orders core (CRUD, advance, checkout) — bien
- Tables CRUD — bien
- Inventory counts (excepto cálculo de avg) — bien
- Recipes CRUD (excepto DELETE) — bien
- Reports (dashboard, sales, top items) — eficiente
- Personnel routes con cálculo correcto de overhead peruano (40%) — excelente
- Audit logs — completo
- Transformations (yields, executions) — excelente
- Admin maintenance (backfill, health/data) — sólido
- Variables de entorno con defaults MOCK correctos en dev — buena práctica
- Cobertura de `asyncHandler` y `zod` schemas en endpoints — 100%

**Frontend:**
- Login form: 5/5 funcionales
- Cliente.html: 12/12 funcionales (100%)
- Cocina.html: 17/17 funcionales (100%)
- Partners.html: 5/5 funcionales (100%)
- Hub catálogo: 6/8 funcionales (75% — los 2 broken son el "Activar plan")
- Multi.html: 6/8 funcionales (75%)
- Sistema de feature flags: **9/9 data-feature alineados con catálogo** (100%)
- Login → /api → token flow funcionando

---

## 🎯 Top 10 fixes priorizados (ROI más alto)

| # | Bug | Archivo:línea | Esfuerzo | Impacto |
|---|---|---|---|---|
| 1 | Cobrar en admin (cierre de mesa) | admin.html:786-787 | 2-3 días | 🔥 Alto |
| 2 | Conteo de inventario en ERP | erp.html:968-1026 | 2-3 días | 🔥 Alto |
| 3 | Activar plan desde wizard | index.html:1842 | 30 min | Medio |
| 4 | Pagos reales (Culqi/Niubiz) | payments.routes.ts:97 | 5-7 días | 🔥 Crítico prod |
| 5 | SUNAT real (Nubefact) | sunat.service.ts:151 | 5-7 días | 🔥 Crítico prod |
| 6 | Transacciones atómicas | 3 lugares | 1-2 días | 🔥 Crítico prod |
| 7 | qrToken validation en socket | sockets/index.ts:68 | 2 horas | Medio |
| 8 | Auth en modifications | modifications.routes.ts:15 | 1 hora | Medio |
| 9 | Stubs en admin (8 botones) | admin.html | 2 días | Medio |
| 10 | Restaurar restaurantId en recipes/menu/tables | 3 archivos | 4 horas | Bajo (latente) |

**Total para tener producción real:** ~25-30 días de trabajo de un dev senior, distribuidos entre backend integrations (15d), frontend stubs (10d), QA y tests (5d).

---

## 🚦 Riesgos identificados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| **Cliente paga en demo y nada se procesa** | 🔥 Alta | NO cobrar hasta integrar Culqi/Niubiz |
| **Comprobantes inválidos vs SUNAT** | 🔥 Alta | NO emitir hasta Nubefact integrado |
| **Race conditions causan inventario desincronizado** | Alta | Implementar transactions YA |
| **Cliente con qrToken espía otras mesas** | Media | Fix socket.io en 2h |
| **Cualquiera modifica órdenes ajenas** | Media | Auth en modifications |
| **Stubs visibles al cliente final** | Media | Audit + remoción/implementación |
| **N+1 queries con muchos órdenes** | Baja | Monitorear, no preventivo |

---

## 📋 Checklist para "production-ready"

- [ ] Integración Culqi o Niubiz en pagos
- [ ] Integración Nubefact en comprobantes SUNAT
- [ ] `prisma.$transaction()` en payments + orders + sunat sequence
- [ ] qrToken validation en socket.io subscribe:table
- [ ] Auth o qrToken en /api/modifications POST
- [ ] restaurantId validation en recipes DELETE, menu GET, tables /call
- [ ] AI fallback notification (header X-AI-Source)
- [ ] JWT_SECRET min 32 chars en producción
- [ ] Stubs P0 frontend implementados (admin cobro + ERP conteo)
- [ ] Multi-restaurant backend (UserRestaurantAccess refactor) — hoy mocked
- [ ] Sistema de billing recurrente (Stripe/Culqi)
- [ ] Self-service signup + onboarding wizard
- [ ] Términos y condiciones + privacidad
- [ ] Tests automatizados (Vitest backend, Playwright frontend)
- [ ] Monitoring (Sentry o similar)

---

*Reporte generado por QA agents (frontend + backend en paralelo). Si necesitas que profundice en algún hallazgo específico o que arregle alguno, indícame cuál.*
