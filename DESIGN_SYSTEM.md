# MesaSmart · Design System

Sistema de diseño unificado para las 7 superficies del producto. Inspirado en lo mejor de Mr. Yum, Sunday, Toast, Lightspeed, Sortly y aplicado al contexto peruano gastronómico.

---

## 1. Principios de diseño

| # | Principio | Por qué importa |
|---|---|---|
| 1 | **Comestible primero** | El producto vende comida. Las fotos, los precios, los nombres son protagonistas — la UI se queda atrás. |
| 2 | **Una intención por pantalla** | Cada pantalla debe tener UN call-to-action principal claro. Lo demás es contexto. |
| 3 | **Densidad por rol** | Cliente = aire y tipografía grande. Cocina = densidad alta y datos. Admin = balance. Mozo = ultra-compacto móvil. |
| 4 | **Touch-first** | Todos los targets táctiles ≥ 44px. Pensado para tablets y smartphones bajo presión real de servicio. |
| 5 | **Velocidad percibida** | Animaciones ≤ 300ms. Skeletons en vez de spinners. Optimistic updates. |
| 6 | **Estados visibles** | Loading, empty, error, success — todos diseñados, nunca dejados al default del navegador. |
| 7 | **Consistencia de marca** | Mismo logo, paleta, typography en login → cualquier vista interna. El usuario nunca duda dónde está. |

---

## 2. Design Tokens

### Paleta

```
COLORES BASE
--cream         #FAF7F2   — fondo principal claro
--paper         #FFFFFF   — superficies elevadas, cards
--ink           #2A1F1A   — texto principal
--muted         #6B5D52   — texto secundario, helpers
--border        #E8DFD3   — bordes sutiles, dividers
--charcoal      #1F1A17   — fondo dark (KDS), botones primarios oscuros
--cream-soft    #F0E8D8   — fondo secundario claro

ACENTOS DE MARCA
--clay          #A0322B   — acento principal · CTAs · queja · alerta
--clay-dark     #7E2820   — hover de clay
--clay-light    #C4493A   — variantes
--gold          #C8941F   — VIP · destacados premium · sugerencias chef
--gold-light    #E5B458   — gold sutil

ESTADOS
--olive         #2D7D5A   — success · listo · OK
--warn          #D97706   — atención · valle · pendiente
--danger        #DC2626   — error · crítico · queja activa
--sky           #3B82F6   — info · reservado · sugerencia neutral
--purple        #7C3AED   — bebidas · postres premium

GRADIENTES SIGNATURE
--gradient-primary    linear-gradient(135deg, #A0322B 0%, #C8941F 100%)
--gradient-night      linear-gradient(135deg, #1F1A17 0%, #2A1F1A 100%)
--gradient-warm-bg    linear-gradient(180deg, #FAF7F2 0%, #F0E8D8 100%)
```

### Tipografía

```
FAMILIAS
--font-display   "Playfair Display", serif   — títulos hero, branding, números grandes
--font-sans      "Inter", system-ui, sans    — todo el UI: labels, body, botones
--font-mono      "JetBrains Mono", monospace — números/datos en KDS, admin, timers

ESCALA (rem · px @ 16px base)
--text-xs        0.6875rem (11px)   labels metadata
--text-sm        0.8125rem (13px)   helpers, microtexto
--text-base      0.9375rem (15px)   body
--text-lg        1.0625rem (17px)   subtítulos, cards
--text-xl        1.25rem   (20px)   sección headers
--text-2xl       1.5rem    (24px)   page titles secundarios
--text-3xl       1.875rem  (30px)   page titles
--text-4xl       2.25rem   (36px)   hero medio
--text-5xl       3rem      (48px)   hero grande
--text-6xl       4rem      (64px)   hero XXL (welcome)

PESOS
400  body
500  meta
600  semibold (botones, labels)
700  bold (énfasis)

LETTER-SPACING
--tracking-tight    -0.025em  (titulares serif)
--tracking-base      0
--tracking-wide      0.05em   (eyebrows)
--tracking-wider     0.10em   (uppercase labels)
--tracking-widest    0.18em   (badges)
```

### Spacing (escala 4)

```
--space-1     4px
--space-2     8px
--space-3     12px
--space-4     16px
--space-5     20px
--space-6     24px
--space-8     32px
--space-10    40px
--space-12    48px
--space-16    64px
--space-20    80px
```

### Border radius

```
--radius-sm    8px    inputs pequeños, chips
--radius-md    12px   botones, cards pequeñas
--radius-lg    16px   cards medianas
--radius-xl    20px   cards principales
--radius-2xl   24px   modals, sheets
--radius-full  100px  pills, FABs, avatares
```

### Sombras

```
--shadow-soft    0 1px 3px rgba(31,26,23,0.04), 0 1px 2px rgba(31,26,23,0.06)
--shadow-card    0 4px 16px rgba(31,26,23,0.06), 0 1px 4px rgba(31,26,23,0.04)
--shadow-float   0 12px 32px rgba(31,26,23,0.10)
--shadow-glass   0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.05) inset
--shadow-cta     0 12px 32px rgba(160,50,43,0.40)
```

### Motion

```
DURATIONS
--duration-fast      150ms   feedback inmediato
--duration-normal    250ms   transiciones standard
--duration-slow      400ms   reveal animations
--duration-ambient   2-30s   orbs, drift, parallax

EASING
--ease-out         cubic-bezier(0.16, 1, 0.3, 1)   default para entrada
--ease-in-out      cubic-bezier(0.45, 0, 0.55, 1)  para hover y toggle
--ease-spring      cubic-bezier(0.5, 1.5, 0.5, 1)  bouncy (toasts, FABs)

PATRONES
fade-in           opacity 0→1 en 250ms
slide-up          translateY(20px)→0 + fade en 350ms (sheets)
pop               scale(0.85)→1 + fade en 300ms (toasts)
ring-pulse        box-shadow expanding (FAB urgent)
shimmer           gradient sweep para skeletons
drift             scale + translate ambient (welcome bg)
```

---

## 3. Patrones de componentes

### Botones

```
BUTTON-PRIMARY        gradient-primary · white text · radius-full · shadow-cta · 14px padding
BUTTON-PRIMARY-DARK   charcoal bg · white text · radius-md · 14px padding (admin/mozo)
BUTTON-SECONDARY      paper bg · border · ink text · radius-full · 12px padding
BUTTON-GHOST          transparent · ink text · 8px padding
BUTTON-DANGER         danger bg · white text · radius-md
BUTTON-VIP            gold bg · charcoal text · radius-full
FAB                   gradient-primary · pill · shadow-float · pulse-ring opcional
```

### Cards

```
CARD-DEFAULT          paper · border · radius-lg · shadow-soft · padding 16-24px
CARD-ELEVATED         paper · radius-xl · shadow-card · sin border (más prominente)
CARD-DARK             charcoal · radius-lg · padding 20px (KDS tickets, hero blocks)
CARD-GLASS            white/0.10 · backdrop-blur(20-24px) · border white/0.18 · radius-2xl
CARD-STATUS           border-left 4px del color del status · resto neutral
```

### Inputs

```
INPUT-DEFAULT         cream bg · border · radius-md · 12-14px padding
INPUT-FOCUS           paper bg · border-clay · ring 4px clay/0.08
INPUT-GLASS           white/0.10 · backdrop-blur · border white/0.20 (sobre fondo dark)
SELECT                misma base + chevron-down a la derecha
TEXTAREA              radius-md · resize-none · min 60px height
SEARCH                radius-full · icon search dentro · placeholder "Buscar..."
```

### Pills / Badges

```
PILL-NEUTRAL          bg cream · text muted · radius-full · 6px 12px padding · tracking-wider
PILL-STATUS-OK        bg olive/10 · text olive · border olive/30
PILL-STATUS-WARN      bg warn/10 · text warn · border warn/30
PILL-STATUS-DANGER    bg danger/10 · text danger · border danger/40
PILL-VIP              bg gold · text charcoal · uppercase · letter-spacing widest
BADGE-COUNT           bg clay · text white · circular · 16px · text-xs bold
```

### Sheets y modales

```
BOTTOM-SHEET          fixed bottom · radius-2xl top · slide-up animation · max-h 92vh
DIALOG-CENTER         fixed center · max-w-md · radius-2xl · padding 24px · pop animation
TOAST                 fixed bottom-center · charcoal bg · radius-full · pop animation · 1.8s auto-dismiss
ACTION-SHEET-MOBILE   slide-up bottom 100% width · grid de acciones grandes (60px+)
```

### Estados especiales

```
EMPTY-STATE           icono grande (48-64px) circular · título display · descripción muted · CTA opcional
LOADING-SKELETON      shimmer animation sobre cream · misma forma del contenido
ERROR-STATE           icono alert · título danger · mensaje · botón "Reintentar"
SUCCESS-CELEBRATION   check icon con rings expandiendo · texto display · timing más lento
```

---

## 4. Densidad por superficie

| Superficie | Densidad | Tipografía base | Padding cards | Touch min | Tema |
|---|---|---|---|---|---|
| **Login** | Aire abundante | 15px | 32px | 56px | Glass dark |
| **Hub** | Aire abundante | 15px | 28px | 48px | Light premium |
| **Cliente** | Media-alta (foto) | 15-17px | 16-20px | 56px | Light cream |
| **Cocina KDS** | Muy alta (datos) | 13-14px mono | 12-16px | 44px | Dark charcoal |
| **Admin** | Media-alta | 14-15px | 20-24px | 40px | Light cream + sidebar dark |
| **Mozo móvil** | Compacta | 13-14px | 12-16px | 48px | Light cream |
| **ERP** | Media-alta (data + foto) | 14-15px | 16-20px | 40px | Light cream |

---

## 5. Iconografía

**Sistema:** Lucide-style (línea, 1.5-2px stroke, 24px viewBox).
**Tamaños:** 12 / 14 / 16 / 18 / 20 / 24 / 32 / 48 px.
**Color:** hereda de `currentColor`.

**Iconos críticos del producto:**
```
bell · check · alert · clock · users · utensils · chef
star (VIP) · flame (popular) · sparkle (AI) · zap
heart · search · plus · minus · x · chevronRight
receipt · cash · printer · camera · package · truck
```

**Emojis para categorías de comida:** 🍗 🥩 🍢 🥪 🥗 🍟 🥤 🍰 🍷 🌶️ 🥑 🥬 🍋 🌽
Solo emoji para fallback cuando falta foto. Nunca emoji en UI funcional.

---

## 6. Accesibilidad

- **Contraste mínimo** AA (4.5:1 texto normal, 3:1 large). El par `clay/cream` cumple.
- **Focus visible** en todos los interactivos (ring 2-4px).
- **Targets táctiles** ≥ 44×44 px.
- **Aria labels** en botones que solo tienen icono.
- **Reduced motion** — respetar `prefers-reduced-motion: reduce`.
- **Keyboard navigation** — orden lógico de tab.
- **Empty states** anuncian a screen readers ("Sin resultados").
- **Idiomas** ES default, EN/PT preparados.

---

## 7. Auditoría UX y plan de polish

### Login `login.html` ✅ **Premium**
Glass card sobre foto ambient · orbs · gradient CTA. **Sin cambios.**

### Hub `index.html` 🟡 **Polish ligero**
Bueno pero podría sentirse más editorial. **Por mejorar:**
- Hero photo en lugar de gradient pleno (consistencia con login)
- Cards de roles con micro-interacción más rica al hover
- Stats con counter animado al cargar
- Footer con créditos y links a docs

### Cliente `cliente.html` ✅ **Recientemente upgraded**
Welcome glassmorphic premium · Success celebratoria · Menu foto-first. **Pendiente:**
- Loading skeleton al fetch del backend
- Empty state diseñado en filtros sin resultados
- Confirmación de pago con micro-celebración

### Cocina KDS `cocina.html` ✅ **Funcional para contexto**
Dark theme alta densidad correcto. **Polish ligero:**
- Notification sound real al recibir ticket
- Animation de bump más satisfactoria
- Stats panel con counter live

### Admin `admin.html` 🟡 **Polish medio**
Funcional pero "neutro". **Por mejorar:**
- Dashboard cards con hover lift + iconos colorizados
- Tablas con zebra y hover row
- Floor plan con micro-animaciones (mesa pulse cuando llaman)
- Sidebar con sub-secciones agrupadas con headers (HOY · OPERAR · ANALIZAR)

### Mozo `mozo.html` 🟡 **Polish medio**
Funcional, mobile correcto. **Por mejorar:**
- Header con gradient sutil + foto de avatar real
- Cards de mesas con sombra premium
- Asistente IA cards con estado animado
- Plano del salón con animación de mesa al tap

### ERP `erp.html` 🟡 **Polish medio**
Densa, ultra-visual ya. **Por mejorar:**
- Dashboard "Buenas noches Marcos" con foto/avatar
- Inventario cards con badge de stock más prominente
- P&L charts con animación al cargar
- Campañas con preview visual de la campaña antes de lanzar

---

## 8. Roadmap de polish (orden recomendado)

| # | Vista | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | Crear `assets/tokens.css` global | 30 min | ⭐⭐⭐⭐⭐ |
| 2 | Hub (index.html) elevación | 30 min | ⭐⭐⭐⭐ |
| 3 | Mozo polish (header + cards) | 45 min | ⭐⭐⭐⭐ |
| 4 | Admin sidebar + dashboard hover states | 60 min | ⭐⭐⭐⭐ |
| 5 | ERP Inventario + P&L charts | 60 min | ⭐⭐⭐ |
| 6 | Cliente loading/empty states | 30 min | ⭐⭐⭐ |
| 7 | KDS micro-animations | 30 min | ⭐⭐ |

**Total estimado:** ~5 horas de polish para que todas las vistas se sientan parte de un mismo producto premium.
