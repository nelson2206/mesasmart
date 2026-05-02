# Plan de pivote estratégico · post-feedback experto

> Análisis de transcripción de llamada con experto del sector restaurantero peruano. Plan de cambios al producto MesaSmart.

---

## 1. Insights críticos del experto

### 🎯 La competencia y su moat
- **InfoRes domina ~70% del mercado limeño** con un sistema de hace **15-18 años**.
- Su ventaja real **no es el software** — es el **modelo de implementación**: empresa partner que instala, capacita, cobra setup + mensualidad + tickets. Es un servicio + software, no solo SaaS.
- Software competidor moderno (ej: [restaurant.py](http://restaurant.py)) **falla porque viene de TI, no de operación** — no entiende el dolor real.

### 💡 La oportunidad
- **ERP burocratizado** en InfoRes → restaurantes pequeños/medianos lo sufren.
- **Falta de flexibilidad** según tamaño — un restaurante con 1 local no necesita lo mismo que una cadena de 50.
- Lo que el mercado quiere: **ERP modular, ad-hoc, simple, hecho desde la operación**.

### 🔑 La diferencia competitiva real
**Conversiones de insumos** — es el corazón del costo de comida en cocina peruana:

```
Pescado entero (M.P.)
    ↓ S/ 18/kg
Sin vísceras
    ↓ S/ 22/kg  (rendimiento: 80%)
Fileteado
    ↓ S/ 28/kg  (rendimiento: 60% del original)
Picado
    ↓ S/ 32/kg  (rendimiento: 55%)
Sancochado / preparado
    ↓ S/ 38/kg  (rendimiento: 50%)
```

Para una **planta de producción** necesitas TODOS los niveles. Para un **restaurante simple**, solo conversiones básicas. Mi schema actual de `Ingredient + RecipeIngredient` **NO modela esto bien** — es plano.

### 🇵🇪 Realidad cultural peruana
- **Tablet en mesa NO es la punta de lanza** en Perú. El dueño lo ve como reemplazo de mano de obra (resistencia generacional). Funciona solo en fast food / alta transaccionalidad (KFC, Pizza Hut, McDonald's, Popeyes).
- **Totems (TVs táctiles)** sí funcionan bien en fast food. Es prácticamente diseño + hardware comodity.
- Para restaurante mediano peruano de tradición, el dolor real está en **back-office** (inventario, costos, mermas, P&L), **no en el front**.

### 📈 Estrategia de venta validada
- Construir versión grande, después podar módulos según cliente.
- Modelo go-to-market: necesitamos una **red de empresas implementadoras** (como InfoRes), no solo software.

---

## 2. Lo que MesaSmart ya tiene bien · validado

✅ **Backend modular multi-tenant** — escala 1 a N restaurantes.
✅ **Recetas** que descuentan inventario.
✅ **Auto-pedidos a proveedores** cuando insumo crítico.
✅ **P&L** por mozo / día / categoría / hora.
✅ **CRM básico** + **campañas IA** + Smart Priority en cocina.
✅ **Caducidad por lotes** (FEFO).
✅ **SUNAT** (boletas, facturas, RUC, IGV).

---

## 3. Lo que cambia · PIVOTE

### 3.1 Repriorización del producto

| Componente | Antes (énfasis) | Ahora (énfasis) |
|---|---|---|
| **Cliente tablet** (cliente.html) | ⭐⭐⭐⭐⭐ punta de lanza | ⭐⭐ add-on opcional |
| **ERP / inventario** | ⭐⭐⭐ feature secundario | ⭐⭐⭐⭐⭐ **el core de venta** |
| **Cocina KDS** | ⭐⭐⭐⭐ | ⭐⭐⭐ (sigue siendo importante) |
| **Mozo** | ⭐⭐⭐ | ⭐⭐⭐ |
| **Admin / multi-local** | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Totem fast food** | NO existe | ⭐⭐⭐ alternativa al tablet (decidir) |

### 3.2 Nuevo posicionamiento

**Antes:** "Sistema integral con experiencia de cliente innovadora desde la mesa"
**Ahora:** "El ERP de operación restaurantera peruana — control de costos, inventario y multi-local sin complicaciones"

El cliente-tablet pasa a ser un **diferenciador opcional**, no el hook principal.

---

## 4. Cambios concretos al producto

### 🔥 PRIORIDAD CRÍTICA (must-do)

#### A. Modelo de conversiones de insumos (gap grande)

**Problema actual:** mi `Ingredient` es plano. Una receta consume X kg de "Pescado" pero no diferencia entre `Pescado fresco entero` vs `Pescado fileteado` con costos distintos.

**Solución:** nuevo modelo de transformación.

```prisma
model IngredientTransformation {
  id              String     @id @default(cuid())
  fromIngredientId String    // M.P. (Pescado entero)
  toIngredientId   String    // Producto transformado (Filete)
  inputQty         Float     // 1 kg pescado entero
  outputQty        Float     // 0.6 kg filete
  yieldPct         Float     // 60% (calculado)
  laborCostCents   Int       @default(0)  // costo de mano de obra del proceso
  notes            String?
  station          String?   // brasa, frio, prep
}
```

Cada **conversión** crea movimiento de kardex que descuenta input y suma output. La receta puede consumir el ingrediente en **el nivel** correcto (filete vs entero).

**Flujo:**
1. Llega 10 kg de pescado entero (M.P.) → kardex `+10 kg pescado_entero` @ S/ 18
2. Cocina hace transformación: 5 kg → fileteado (yield 60%) → 3 kg filete @ S/ 30 (incluye merma + labor)
3. Receta de "Tiradito" consume 0.2 kg de filete (no de pescado entero)
4. Reportes muestran tasa de yield real vs esperada → detectar desperdicio

#### B. Modularidad por tamaño de empresa

**Problema:** ahora todos los módulos están "siempre on". Restaurante chico se asusta con la complejidad.

**Solución:** sistema de **planes/módulos activables** por restaurante.

```prisma
model RestaurantPlan {
  id            String     @id @default(cuid())
  restaurantId  String     @unique
  // Módulos activos
  pos           Boolean    @default(true)   // Carta + pedidos básico (siempre on)
  inventory     Boolean    @default(false)  // Insumos + recetas + descuento auto
  transformations Boolean  @default(false)  // Conversiones de insumos (planta)
  multiLocation Boolean    @default(false)  // Multi-sede
  pnl           Boolean    @default(false)  // P&L y reportes financieros
  campaigns     Boolean    @default(false)  // CRM + campañas IA
  customerTablet Boolean   @default(false)  // Cliente-tablet en mesa
  totem         Boolean    @default(false)  // Totem fast food
  ai            Boolean    @default(false)  // Features IA (visión, sugerencias)
}
```

Plan **Solo POS** (chico) = pos: true · resto false → UI simple, una sola vista.
Plan **Standard** (mediano) = pos + inventory + pnl → backoffice básico.
Plan **Enterprise** (cadena) = todo on.

#### C. Recepción de guías (ingreso de mercadería)

**Hoy:** llegan insumos pero el flujo de "recibir guía" no está bien diseñado. La guía física que trae el proveedor con detalle de productos, lotes, vencimientos.

**Solución:** flujo dedicado:
1. Crear `GoodsReceipt` con foto/PDF de guía adjunta.
2. AI extrae items con cantidades (Claude Vision sobre la guía).
3. Usuario verifica vs PO existente, ajusta cantidades reales.
4. Auto-genera lotes con fechas de vencimiento si aplican.
5. Discrepancias (recibí menos, vino dañado) → claim al proveedor.

```prisma
model GoodsReceipt {
  id              String     @id @default(cuid())
  restaurantId    String
  supplierId      String
  purchaseOrderId String?    // si vino de un PO
  guideNumber     String     // número de guía del proveedor
  guideUrl        String?    // foto/PDF de la guía
  receivedAt      DateTime   @default(now())
  receivedBy      String     // userId
  status          String     // PENDING_REVIEW | CONFIRMED | DISCREPANCY
  totalCents      Int        @default(0)
  notes           String?
  lines           GoodsReceiptLine[]
}

model GoodsReceiptLine {
  id              String     @id @default(cuid())
  receiptId       String
  ingredientId    String
  qtyOrdered      Float?
  qtyReceived     Float
  qtyAccepted     Float       // < qtyReceived si hubo merma a la recepción
  unitCostCents   Int
  expirationDate  DateTime?
  lotNumber       String?
  notes           String?
}
```

#### D. Seguridad operativa y auditoría

**Hoy:** el inventario se ajusta sin trazabilidad fuerte. Los dueños tienen miedo de mermas y robos.

**Solución:**
1. **Audit log obligatorio** en cualquier ajuste manual de stock con razón obligatoria.
2. **Limites por rol**: cocinero no puede ajustar stock, solo reportar merma. Admin aprueba.
3. **Conciliación cíclica**: KPI semanal de "ajustes manuales > X%" alerta a dueño.
4. **Diferencia teórico vs real** después de inventariado físico → asignar responsable.

```prisma
model AuditLog {
  id           String     @id @default(cuid())
  restaurantId String
  userId       String
  action       String     // ADJUSTMENT, DELETE, ROLE_CHANGE, etc
  entityType   String     // Ingredient, Order, etc
  entityId     String
  before       String     // JSON snapshot
  after        String
  reason       String?
  createdAt    DateTime   @default(now())
}
```

### 🟡 PRIORIDAD ALTA (should-do · siguientes 2 sprints)

#### E. Onboarding asistido para empresa implementadora

**Insight:** ganar como InfoRes con red de implementadores.

- **Modo "Implementador"** en admin: crea cuenta de restaurante, configura plan, importa menú/insumos masivamente vía Excel.
- **Plantillas por tipo de restaurante**: pollería, cevichería, criolla, parrilla, fast food. Pre-pobladas con menú típico + insumos típicos + recetas típicas.
- **Documentación operativa**: manuales auto-generados en PDF para el cliente.

#### F. Costos por mano de obra en recetas

Una receta no solo consume insumos — también minutos de cocinero. Para platos manuales como anticuchos, el labor cost importa.

```prisma
model RecipeIngredient {
  ...
  laborMinutes    Float?    // minutos de mano de obra
  laborCostCents  Int?      // costo calculado o manual
}
```

Reporte: P&L por plato debe incluir labor además de food cost para margen real.

#### G. Vista resumen ejecutivo para dueño / mediano

Hoy el admin tiene muchas vistas. El dueño de un solo local quiere **una pantalla** con lo crítico:
- Cuánto vendió hoy / esta semana / este mes
- Cuánto gastó en compras / labor
- Margen real
- Productos top
- Mermas detectadas
- Alertas

Crear `dueno.html` o pantalla "Resumen ejecutivo" en admin.

#### H. Multi-local consolidado

Si tiene 3 locales, quiere ver:
- P&L consolidado y por local
- Comparativos: cuál local vende más, cuál tiene más merma
- Transferencias de insumos entre locales
- Compras centralizadas (1 PO para 3 locales) con distribución

```prisma
model Location {
  id              String     @id @default(cuid())
  organizationId  String      // grupo / cadena
  name            String     // "Miraflores", "San Borja"
  ...
}

// Restaurant pasa a tener locationId
```

### 🟢 PRIORIDAD MEDIA (nice-to-have · siguientes 4 sprints)

#### I. Totem fast food (decisión)

**Pregunta clave del experto:** ¿vale la pena para 1-2 clientes?

**Respuesta tentativa:** Sí, **pero como módulo aparte y opcional**. Puede ser literalmente un fork ligero de cliente.html con:
- UI más grande (TV 32"+)
- Flujo más simple (no "llamar mozo" — pago en totem y llevas tu pedido)
- Pago integrado (NFC + lector tarjeta + Yape QR)

Costo de implementación: ~1 semana de trabajo. Hardware: TV + mini PC + lector. **Solo cuando aparezca el primer cliente que lo pida.**

#### J. Cliente-tablet pasa a "add-on" comercial

- Sigue funcionando, pero no es el hero del pitch.
- Marketing: "tu menú digital con QR + opcionalmente tablet en mesa".
- Cobrar adicional por la versión tablet (instalación + soporte hardware).

### ⚪ DESPRIORIZAR / PARKING

- **Más features de cliente** (favoritos avanzados, gamification, login social, etc.) — no son el dolor real del mercado.
- **Integraciones avanzadas con delivery apps** (Rappi, PedidosYa) — útil pero después de validar core.
- **Loyalty programs complejos** — el CRM básico que tenemos es suficiente.

---

## 5. Cambios al schema Prisma · resumen

### Modelos NUEVOS
```
IngredientTransformation     conversiones M.P. → producto
RestaurantPlan               módulos activos
GoodsReceipt + Line          recepción de guías
AuditLog                     trazabilidad
Location                     multi-local
RecipeStep                   pasos de preparación con tiempo
LaborRate                    costos de mano de obra por estación
```

### Modelos MODIFICADOS
```
Restaurant                   + organizationId, locationId
RecipeIngredient             + laborMinutes, laborCostCents, ingredientLevel
Ingredient                   + level (M.P. | INTERMEDIATE | FINAL), parentIngredientId
PurchaseOrder                + locationId
InventoryMovement            + sourceLocationId, destLocationId (transferencias)
```

---

## 6. Cambios al frontend · resumen

| Vista | Cambio |
|---|---|
| **erp.html** | Nueva sección **Conversiones de insumos** + **Recepción de guías** + sección **Multi-local** condicional al plan |
| **admin.html** | Nuevo módulo **Configuración de plan** + dashboard adaptable según plan activo + **Auditoría** |
| **cliente.html** | Marcar como **add-on**: agregar onboarding "este restaurante usa MesaSmart Tablet" sutil. Sin cambios funcionales mayores |
| **cocina.html** | Sin cambios mayores (sigue siendo crítico) |
| **mozo.html** | Sin cambios mayores |
| **NUEVO `dueno.html`** | Vista ejecutiva para dueño de 1 local · todo lo crítico en una pantalla |
| **NUEVO `totem.html`** | Módulo aparte para fast food (en parking, decidir) |

---

## 7. Roadmap revisado

### Sprint 1 (esta + próxima semana) — CORE PIVOT
- [ ] Schema: `IngredientTransformation`, `RestaurantPlan`, `GoodsReceipt`, `AuditLog`
- [ ] Migración + seed con ejemplo de conversiones (pollo + pescado)
- [ ] Backend: rutas para transformations, plan, goods receipts
- [ ] ERP: nueva sección "Conversiones" + flujo "Recibir mercadería" con foto IA
- [ ] Admin: vista de "Plan del restaurante" con toggles
- [ ] Audit log en todos los ajustes de stock

### Sprint 2 — IMPLEMENTADOR & DUEÑO
- [ ] Modo "Implementador": importar Excel masivo de menú + insumos
- [ ] Plantillas por tipo de restaurante (pollería, cevichería, criolla)
- [ ] `dueno.html` — vista ejecutiva resumen
- [ ] Costos de labor en recetas

### Sprint 3 — MULTI-LOCAL
- [ ] Schema: `Organization`, `Location`
- [ ] Migración a multi-location
- [ ] P&L consolidado + comparativos
- [ ] Transferencias de insumos entre locales
- [ ] Compras centralizadas

### Sprint 4 — DECISIÓN TOTEM (si hay cliente)
- [ ] `totem.html` ligero
- [ ] Integración pago en totem
- [ ] Documentación de hardware recomendado

---

## 8. Cambios al pitch / posicionamiento

### Antes
> "MesaSmart · Sistema integral con experiencia premium en mesa para restaurantes peruanos"

### Ahora
> "MesaSmart · El ERP simple para tu restaurante peruano. Controla tus costos, inventario y operación. Crece de 1 a 50 locales sin cambiar de sistema."

**Hooks revisados:**
- ❌ "Tu cliente pide desde la mesa con tablet" (no es lo que mueve al dueño)
- ✅ "Conoces tu costo real por plato — incluyendo mermas y labor"
- ✅ "Recibe mercadería en 30 segundos con foto IA"
- ✅ "Detecta robos y desperdicios automáticamente"
- ✅ "Empieza con 1 local, escala a 50 sin migrar"

### Para implementadores
- "Vende MesaSmart a tus clientes, nosotros te damos margen recurrente y soporte técnico"
- Network de partners certificados → mismo modelo que InfoRes pero con software moderno

---

## 9. Decisiones que necesitas tomar

1. **¿Vamos con el pivote completo a ERP-first?** O mantenemos cliente-tablet como hero y agregamos lo del experto encima.

2. **¿Construimos modelo de partners/implementadores?** Esto cambia el go-to-market del producto.

3. **¿Totem sí o no?** Mi sugerencia: parking hasta tener cliente que lo pida concreto.

4. **¿Empezamos por conversiones de insumos o por modularidad?** Conversiones resuelve un dolor más profundo, modularidad hace el producto más vendible. Yo iría por **conversiones primero** — es el diferenciador real.

5. **¿Demo para experto?** Sugiero preparar una demo del schema de conversiones + flujo de recepción de guías para mostrarle mañana en la reunión que mencionó. Eso le valida que **escuchaste y respondiste rápido**, lo que mejora la relación.

---

## 10. Lo que voy a hacer si me das luz verde

Si dices "sí", arranco mañana en este orden (1-2 días de trabajo enfocado):

1. **Schema Prisma actualizado** con `IngredientTransformation`, `RestaurantPlan`, `GoodsReceipt`, `AuditLog`.
2. **Backend**: rutas para los 4 nuevos modelos + tests básicos.
3. **Frontend ERP**: nueva sección "Conversiones de insumos" con flujo visual de transformación pescado → filete con yield real.
4. **Frontend ERP**: flujo "Recibir mercadería" con upload de foto de guía + AI Vision.
5. **Admin**: panel "Plan del restaurante" con toggles modulares.
6. **Pitch deck actualizado** (1 página) con el nuevo posicionamiento.

¿Avanzo? Y si tienes la reunión mañana con el experto, dime cuándo es y te preparo materiales específicos para esa conversación.
