# MesaSmart · Sistema integral para restaurantes peruanos

> Plataforma SaaS multi-rol para restaurantes en Perú · Cumple SUNAT · Diseñada con benchmarks de Mr. Yum, Toast, Sunday, Lightspeed, Sortly, MarketMan y Apicbase.

## 🎯 Demo en vivo

**Hub:** [Abrir el sistema](./index.html)

| Vista | Dispositivo | Inspirada en |
|---|---|---|
| 🍽️ [Cliente](./cliente.html) | Tablet en mesa | Mr. Yum + Sunday |
| 👨‍🍳 [Cocina KDS](./cocina.html) | Pantalla de cocina | Toast KDS |
| 📊 [Administrador](./admin.html) | PC del operador | Lightspeed |
| 📱 [Mozo](./mozo.html) | Smartphone | Mobile-first |
| 📦 [ERP + IA](./erp.html) | PC de gerencia | Sortly + MarketMan + Apicbase |

> Si abres este repo en GitHub Pages, los links de arriba funcionan directo.

---

## ✨ Qué incluye

### Frontend (5 vistas + hub)

- **Cliente (tablet)** — Carta foto-first con 30 platos · filtros dietéticos · favoritos · llamar mozo · estado del pedido en vivo con per-item tracking · solicitar modificación con confirmación de cocina · cuenta con IGV 18% · división · facturación SUNAT (boleta/factura/ticket) · Yape, Plin, tarjeta, efectivo · encuesta + reseña Google.
- **Cocina KDS** — Tema oscuro · semáforo de tiempos · **Smart Priority** con algoritmo determinístico (wait time, VIP, queja, course optimization, drinks pendientes) · velocidad de salida · ETA cola · routing por estación · modificaciones in-line · prioridad manual.
- **Administrador** — Dashboard con KPIs vivos · floor plan en tiempo real · llamados activos · ventas por hora · top platos · personal del turno.
- **Mozo (mobile)** — 4 tabs · Mis mesas · **Plano del salón** con ubicación · llamados con prioridad urgente · **unión / bloqueo de mesas** (cuando juntas 2 mesas físicamente) · marca de queja que sube prioridad en cocina.
- **ERP + Marketing IA** — 9 secciones ultra-visuales:
  - **Resumen** con KPIs hero, salud por categoría, gráfica de margen 7 días.
  - **Inventario** foto-first (estilo Sortly) con cards por insumo, color status, barra de stock.
  - **Conteo físico con foto IA** — toma foto → IA identifica insumos → confirmas.
  - **Recetas** con food cost por plato y cobertura visual.
  - **Proveedores** con auto-pedido configurable.
  - **Pedidos** con generación automática cuando insumos críticos bajan.
  - **Caducidad** con timeline de riesgo y sugerencias para evitar merma.
  - **P&L** con 4 vistas: día, mozo, categoría, hora pico/valle.
  - **Campañas IA** que analizan baja rotación, expiraciones, horas valle, fechas nacionales (Día del Pollo a la Brasa, Pisco Sour, Fiestas Patrias) y proponen campañas accionables.

### Backend (Node.js + TypeScript + Prisma + Socket.io)

- **40+ endpoints REST** organizados en 15 routers
- **WebSocket** con rooms por rol/mesa/orden y 12+ eventos en tiempo real
- **Smart Priority Service** — algoritmo determinístico explicable
- **Inventory Service** — kardex, FEFO en lotes perecibles, conteos físicos con variance valorizado
- **Purchase Service** — auto-restock agrupado por proveedor
- **P&L Service** — buckets multi-dimensión cruzando ingresos vs COGS
- **AI Service** opcional con Claude:
  - Explicación natural de prioridades para el chef
  - Conteo de inventario por foto (Vision API)
  - Análisis predictivo de caducidad y merma
  - Generación de campañas con análisis de data del negocio
  - Clasificación de quejas
  - Traducción de menú a EN/PT/FR
  - Recomendaciones personalizadas para cliente
- **SUNAT/OSE** con mock para dev y stub Nubefact para producción
- **Fallback determinístico** en todos los endpoints AI — funciona sin API key

---

## 📚 Stack

```
Frontend:  React 18 + Tailwind (CDN, sin build) · Playfair Display + Inter + JetBrains Mono
Backend:   Node.js 20 + Express 4 + TypeScript + Prisma 5 + Socket.io 4
Database:  SQLite (dev) · PostgreSQL (prod)
AI:        Claude API (opcional, todas las features tienen fallback)
SUNAT:     Nubefact (stub) · MOCK por defecto
```

---

## 🚀 Cómo correrlo local

### Solo frontend (sin backend)

Doble click en `index.html` y entras al hub. Cada vista funciona standalone con datos mock.

### Backend + frontend conectado

```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Backend en `http://localhost:3001`. Logins demo:

| Email | Rol | Password |
|---|---|---|
| admin@labrasa.pe | ADMIN | demo1234 |
| maria@labrasa.pe | WAITER | demo1234 |
| cocina@labrasa.pe | KITCHEN | demo1234 |
| caja@labrasa.pe | CASHIER | demo1234 |

### Para activar features de IA (opcional)

En `backend/.env`:

```
ANTHROPIC_API_KEY=tu-key-de-claude
AI_FEATURES_ENABLED=true
```

---

## 📐 Arquitectura

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el documento técnico completo (capas, modelo ER, contratos de API y WebSocket, despliegue).

Ver [`BENCHMARK.md`](./BENCHMARK.md) para el análisis UX/UI de los referentes globales y los 10 principios de diseño aplicados.

---

## 🇵🇪 Cumplimiento normativo

- **SUNAT** — Resolución N° 097-2012/SUNAT y modificatorias · Boletas, Facturas, Notas de Crédito · UBL 2.1 · OSE
- **Tributario** — IGV 18% desglosado · DNI obligatorio en boletas > S/ 700 · ICBPER soportado
- **INDECOPI** — Libro de Reclamaciones digital
- **Ley N° 29733** — Protección de Datos Personales · consentimiento explícito · derecho de eliminación
- **Octógonos nutricionales** considerados en el modelo de datos

---

## 📄 Licencia

Este es un prototipo MVP demostrativo. Todos los nombres de restaurante, datos y precios son ficticios. Las imágenes son de Unsplash bajo su licencia gratuita.

---

## 👤 Autor

Proyecto desarrollado como ejemplo de aplicación SaaS para el sector HORECA peruano.
