# Benchmark UX/UI · Plataformas de Tecnología para Restaurantes

Análisis de los referentes globales más relevantes en 2026, con lecciones concretas aplicables a **MesaSmart**.

---

## 1. Mr. Yum (AU/UK/US) · QR Ordering

**Qué hacen bien**
- **Foto-first**: cada plato tiene foto en alta resolución como protagonista de la tarjeta. Sin foto, el plato no se vende.
- **Búsqueda predictiva**: barra de búsqueda fija en la parte superior con autocompletado de ingredientes y nombres.
- **Filtros como chips horizontales** scrolleables, no como menús desplegables.
- **Carrito flotante en la parte inferior** (sticky bar) con monto y CTA "Ver pedido", visible siempre.
- **Bottom sheets** para todo (detalle de plato, carrito, opciones) en lugar de páginas separadas.

**Lección para MesaSmart**
Reemplazar emoji + gradiente por foto profesional cuadrada (1:1) o 4:3. Mover el botón "Mi pedido" desde el header a una barra inferior flotante.

**Debilidad**
Mr. Yum es solo carta + pago. No tiene KDS ni POS integrado, lo que crea fricciones operativas (la cocina recibe la orden por canal separado). Nuestra arquitectura debe integrar todo de inicio.

---

## 2. Toast (US) · KDS de referencia

**Qué hacen bien**
- **Tema oscuro** (negro/gris carbón) con acentos de color por estado. La cocina está caliente, con vapor y grasa: pantalla oscura es más legible y reduce reflejos.
- **Color por antigüedad del ticket**: verde (recién llegado), amarillo (>5 min), rojo parpadeante (>10 min). Permite priorizar de un vistazo.
- **Tipografía grande y bold**: legible a 1.5–2m de distancia desde la estación de cocina.
- **Cronómetro visible en cada ticket**, contando segundos desde que se recibió.
- **Sonido configurable** al llegar nuevo ticket o cuando cambia un pedido.
- **Vista grid con sizing dinámico**: tickets crecen según cantidad de items, sin scroll innecesario.
- **Botón "Bump"** (gestión por toque): un solo toque marca el ticket como completado y desaparece de la pantalla.
- **Routing por estación**: bar, frío, caliente, postres, parrilla — cada pantalla solo ve lo suyo.

**Lección para MesaSmart**
La pantalla de cocina debe ser totalmente distinta a la del cliente: dark theme, type grande, semáforo de tiempos, no cards "bonitas" sino funcionales y densas en información.

---

## 3. Sunday (FR/UK/US) · Pay-at-table

**Qué hacen bien**
- **Estética minimalista premium**: blanco + tipografía editorial (serif elegante en branding).
- **Flujo de pago en 3 pasos máximo**: ver cuenta → dividir → pagar.
- **División de cuenta visual**: arrastrar items entre comensales o dividir partes iguales con un slider.
- **Apple Pay / Google Pay** como métodos primarios, no tarjeta tradicional.
- **Solicitud de propina con anclaje psicológico**: muestra 15% como default (no 0%) para subir tipping rates.
- **Solicitud de review de Google al final** del flujo de pago — generan 5× más reseñas para el restaurante.

**Lección para MesaSmart**
Trabajar la división de cuenta como una experiencia visual (no solo "entre N personas"). En Perú, integrar Yape/Plin como métodos primarios igual que Apple Pay en Sunday. Pedir reseña al final.

**Métrica clave**
12 minutos ahorrados por mesa, lo que en alta rotación = más vueltas de mesa = más ingresos.

---

## 4. Lightspeed Restaurant · Admin Dashboard

**Qué hacen bien**
- **Plano de mesas en tiempo real** con código de color: libre (verde), ocupada (azul), pidiendo cuenta (amarillo), atrasada (rojo).
- **P&L en vivo**: ventas, costo de mercadería, labor cost, margen — todo en un solo dashboard.
- **Reportes multi-sede**: una cadena ve ventas por local en una grilla.
- **Editor visual de menú**: drag and drop de categorías y platos, con preview de cómo se ve en la app del cliente.
- **Inventario por receta**: descuento automático al vender (1 lomo saltado descuenta 200g de lomo, 100g de cebolla, etc.).

**Lección para MesaSmart**
El admin debe tener un **floor plan** como pantalla principal, no una lista de mesas. Las métricas en cards arriba y el plano abajo. Los reportes detallados son secundarios — lo importante en el dashboard es lo que está pasando AHORA.

---

## 5. Square for Restaurants · POS

**Qué hacen bien**
- **iPad-first design**: layout pensado para tablet horizontal, no smartphone.
- **Sidebar navigation**: navegación principal a la izquierda con íconos grandes.
- **Contraste fuerte**: texto negro sobre blanco, sin grises medios. Legible bajo cualquier luz.
- **Botones grandes (60x60px mínimo)** para uso rápido.

**Lección para MesaSmart**
Mantener layout horizontal para tablet, pero reducir saturación de color y aumentar contraste tipográfico.

---

## 6. Resy / OpenTable · Reservas y discovery

**Qué hacen bien**
- **Hero photography editorial**: foto del ambiente del restaurante como primera imagen, no del logo.
- **Tipografía mixta**: serif (Playfair, Cormorant) para título de restaurante + sans (Inter) para UI.
- **Storytelling**: cada restaurante tiene una bio, fotos del chef, premios. No es solo una carta.

**Lección para MesaSmart**
La pantalla de bienvenida debe tener una foto del local o un plato icónico, no solo el logo + número de mesa. Crear identidad emocional desde el primer segundo.

---

## 7. Joinnus / PedidosYa Perú · Mercado local

**Qué hacen bien (referencia local)**
- **Ofertas y combos** muy visibles arriba de la carta.
- **"Más pedidos hoy"** como sección destacada — funciona en Perú porque la gente sigue tendencias.
- **Métodos de pago locales**: Yape, Plin, transferencia bancaria, pago contra entrega — todos como primer nivel.

**Qué NO hacer (debilidades del mercado local)**
- Fotos de plato de baja calidad o repetidas entre platos.
- Demasiadas promociones encima del producto, satura la vista.
- Mucho texto en mayúsculas que parece "agresivo".

---

## Síntesis · 10 Principios de Diseño para MesaSmart

| # | Principio | De dónde viene |
|---|---|---|
| 1 | Foto-first en cada plato (sin foto, no se vende) | Mr. Yum, Resy |
| 2 | Tipografía mixta: serif editorial + sans clean | Resy, Sunday |
| 3 | Paleta sobria con un acento, no arcoíris | Sunday, alta gastronomía |
| 4 | Carrito sticky en la parte inferior (cliente) | Mr. Yum |
| 5 | KDS oscuro con semáforo de tiempos | Toast |
| 6 | Floor plan como home del admin | Lightspeed |
| 7 | División de cuenta visual e intuitiva | Sunday |
| 8 | Yape/Plin como métodos de pago primarios | Mercado local |
| 9 | Solicitar reseña Google post-pago | Sunday |
| 10 | Bottom sheets para todo, no páginas | Mr. Yum |

---

## Nuevo Sistema de Diseño · MesaSmart 2.0

### Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg-cream` | `#FAF7F2` | Fondo principal |
| `--bg-white` | `#FFFFFF` | Cards, superficies elevadas |
| `--bg-charcoal` | `#1F1A17` | KDS, modo oscuro |
| `--ink-primary` | `#2A1F1A` | Texto principal |
| `--ink-secondary` | `#6B5D52` | Texto secundario |
| `--accent-clay` | `#A0322B` | CTAs, acento principal |
| `--accent-gold` | `#C8941F` | Premium, destacados |
| `--success-olive` | `#2D7D5A` | OK, listo, completado |
| `--warning` | `#D97706` | En preparación, atención |
| `--danger` | `#DC2626` | Atrasado, cancelar |
| `--border` | `#E8DFD3` | Bordes sutiles |

### Tipografía

- **Display**: `Playfair Display` (serif) — nombre del restaurante, títulos hero.
- **UI**: `Inter` (sans) — todo lo demás.
- Escala: 12 / 14 / 16 / 20 / 28 / 36 / 48 / 64 px

### Sombras

- `sm`: `0 1px 3px rgba(0,0,0,0.04)`
- `md`: `0 4px 12px rgba(0,0,0,0.06)`
- `lg`: `0 12px 32px rgba(0,0,0,0.08)`

### Radios

- Botones: `12px`
- Cards: `16px`
- Modales: `24px` (top-only para bottom sheets)

### Iconografía

- **Lucide icons** (línea, 1.5px stroke) — reemplazan emojis en UI funcional.
- Emojis quedan reservados para celebraciones (✓, 🎉) y categorías específicas.

---

## Aplicación · Diferencias por Vista

| Vista | Tema | Estética | Densidad |
|---|---|---|---|
| **Cliente (tablet mesa)** | Light, cream | Editorial, premium, foto-first | Media (5-6 platos por pantalla) |
| **Cocina (KDS)** | Dark | Funcional, alta legibilidad, semáforo | Alta (4-8 tickets por pantalla) |
| **Admin (PC)** | Light | Data-rich, sobrio, profesional | Muy alta (KPIs + tablas) |
| **Mozo (smartphone)** | Light | Compacta, mobile-first, action-oriented | Media (lista vertical) |

Cada rol consume la misma información, pero presentada con la jerarquía y velocidad que su contexto exige.

---

## Sources

- [Mr Yum — QR code mobile ordering](https://mryum.com/qr-code-mobile-ordering)
- [Toast — KDS Grid View Overview](https://support.toasttab.com/en/article/Grid-KDS-Overview)
- [Toast — Kitchen Display Systems](https://pos.toasttab.com/hardware/kitchen-display-system)
- [Sunday — the best way to pay in restaurants](https://sundayapp.com/)
- [Sunday — Pay at Table](https://sundayapp.com/pay-at-table/)
- [Lightspeed — Data dashboard](https://resto-support.lightspeedhq.com/hc/en-us/articles/226305567-Data-dashboard)
- [Best Restaurant POS Systems 2026 — comparativa](https://restaurantvelocity.com/blog/best-restaurant-pos-systems/)
- [Restaurant Tech Trends 2026](https://brand.menumiz.com/2026/01/29/2025s-top-3-restaurant-tech-trends-and-how-to-adopt-them-without-overwhelm/)
