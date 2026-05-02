/**
 * MesaSmart · Catálogo de funcionalidades y feature flags por plan
 * ─────────────────────────────────────────────────────────────────
 * Source-of-truth único para:
 *   - Lista de features agrupadas (mostrada en hub)
 *   - Mapping plan → features incluidas
 *   - Helper isFeatureEnabled(featureId) leyendo el plan activo de localStorage
 *
 * Uso desde otras vistas:
 *   <script src="./assets/features.js"></script>
 *   if (window.MesaSmartFeatures.isEnabled("pnl")) { ... }
 *   const plan = window.MesaSmartFeatures.activePlan();
 */

(function () {
  // ─── 3 PLANES ─────────────────────────────────────────────
  const PLANS = {
    OPERACION: {
      id: "OPERACION",
      name: "Operación",
      tagline: "Para 1 local con inventario y costos · S/ 199/mes",
      priceCents: 19900,
      setupCents: 50000,
      color: "#2D7D5A",
      gradient: "linear-gradient(135deg, #2D7D5A 0%, #4A9B72 100%)"
    },
    PROFESIONAL: {
      id: "PROFESIONAL",
      name: "Profesional",
      tagline: "Para 2-15 locales · IA operativa incluida · S/ 399/mes",
      summary: "ERP completo + IA en cocina, mozo, marketing y compras",
      priceCents: 39900,
      setupCents: 80000,
      color: "#A0322B",
      gradient: "linear-gradient(135deg, #A0322B 0%, #C4493A 100%)"
    },
    ENTERPRISE: {
      id: "ENTERPRISE",
      name: "Enterprise",
      tagline: "Para 16+ locales o cadenas · gobierno corporativo · S/ 1499/mes",
      summary: "Forecasting IA, SSO, integraciones contables/BI, CSM dedicado y SLA 99.9%",
      priceCents: 149900,
      setupCents: 250000,
      color: "#C8941F",
      gradient: "linear-gradient(135deg, #A0322B 0%, #C8941F 100%)"
    }
  };

  // ─── CATÁLOGO DE FUNCIONALIDADES (8 grupos · ~30 features) ───
  // Cada feature tiene: id, name, desc, icon (emoji), plans (array)
  const FEATURE_GROUPS = [
    {
      id: "operacion_diaria",
      name: "Operación diaria",
      desc: "Lo que necesitas para abrir mañana",
      icon: "🍽️",
      color: "#A0322B",
      features: [
        { id: "pos", name: "POS · Tomar pedidos", desc: "Carta digital, mesas, pedidos en cocina", icon: "📋", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "kds", name: "Cocina KDS", desc: "Pantalla de cocina con tickets en tiempo real", icon: "👨‍🍳", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "waiter_mobile", name: "App del mozo", desc: "Mozo toma pedidos desde su celular", icon: "📱", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "floor_plan", name: "Plano del salón", desc: "Estado de mesas en vivo · unir mesas", icon: "🗺️", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "calls", name: "Llamado al mozo", desc: "Cliente llama desde la mesa", icon: "🔔", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "inventario",
      name: "Inventario y costos",
      desc: "Control real de tu materia prima",
      icon: "📦",
      color: "#2D7D5A",
      features: [
        { id: "ingredients", name: "Insumos y stock", desc: "Lista de insumos · stock en tiempo real", icon: "🥩", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "recipes", name: "Recetas", desc: "Cada plato vinculado a sus ingredientes", icon: "📝", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "auto_deduct", name: "Descuento automático", desc: "Vendes plato → descuenta inventario auto", icon: "⚡", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "transformations", name: "Conversiones de insumos", desc: "Pescado entero → fileteado con yield real", icon: "🔄", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "expiration", name: "Caducidad por lotes", desc: "FEFO automático · alertas de vencimiento", icon: "⏰", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "physical_count", name: "Conteo físico", desc: "Inventariado periódico con variance", icon: "🧮", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "photo_count", name: "Conteo por foto IA", desc: "Toma foto de la despensa, IA cuenta", icon: "📷", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "compras",
      name: "Compras y proveedores",
      desc: "Maneja a tus proveedores como pro",
      icon: "🚚",
      color: "#3B82F6",
      features: [
        { id: "suppliers", name: "Lista de proveedores", desc: "Contactos · términos de pago · días de entrega", icon: "📇", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "purchase_orders", name: "Pedidos a proveedores", desc: "POs generadas y enviadas por email", icon: "📨", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "auto_restock", name: "Auto-reposición", desc: "Stock crítico → genera PO automática", icon: "🤖", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "goods_receipt_ai", name: "Recepción con foto IA", desc: "Foto de la guía → IA extrae items", icon: "📥", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "finanzas",
      name: "Finanzas y P&L",
      desc: "Conoce tu margen real al céntimo",
      icon: "💰",
      color: "#C8941F",
      features: [
        { id: "pnl", name: "P&L · Pérdidas y Ganancias", desc: "Por día, mozo, categoría, hora", icon: "📊", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "food_cost", name: "Food cost por plato", desc: "Costo real incluyendo merma", icon: "🧾", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "labor_cost", name: "Costos laborales", desc: "Sueldos + ESSALUD + gratifs · % del net", icon: "👥", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "ebitda", name: "EBITDA y margen real", desc: "Net − COGS − labor = margen real", icon: "📈", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "facturacion",
      name: "Facturación y pagos",
      desc: "SUNAT cumplido · pagos peruanos",
      icon: "🧾",
      color: "#7C3AED",
      features: [
        { id: "sunat", name: "Boletas y facturas SUNAT", desc: "UBL 2.1 firmado · OSE Nubefact", icon: "✅", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "yape_plin", name: "Yape · Plin · Tarjeta · Efectivo", desc: "Todos los métodos peruanos", icon: "💳", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "split_check", name: "Dividir cuenta", desc: "Por persona o por consumo", icon: "✂️", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] },
        { id: "indecopi_book", name: "Libro de Reclamaciones", desc: "Digital INDECOPI integrado", icon: "📕", plans: ["OPERACION", "PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "marketing_crm",
      name: "Marketing y CRM",
      desc: "Conoce y fideliza a tus clientes",
      icon: "💝",
      color: "#A0322B",
      features: [
        { id: "customer_id", name: "Cliente recurrente", desc: "Identifica por email/DNI/celular", icon: "🪪", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "rewards", name: "Rewards por tier", desc: "VIP / Frecuente / Returning automático", icon: "🎁", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "campaigns_ai", name: "Campañas con IA", desc: "Genera promos según data del negocio", icon: "✨", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "queue_ai", name: "Cola de espera con IA", desc: "Asigna mesa óptima · estima espera", icon: "🪑", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "ia_avanzada",
      name: "IA operativa",
      desc: "IA real integrada · no chatbot decorativo",
      icon: "🤖",
      color: "#1F1A17",
      features: [
        { id: "smart_priority", name: "Smart Priority cocina", desc: "Algoritmo prioriza tickets en KDS por mesa, antigüedad y VIP", icon: "⚡", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "ai_assistant_waiter", name: "Asistente IA mozo", desc: "Sugiere acciones en tiempo real al mozo según estado del salón", icon: "🧭", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "ai_explanations", name: "Explicaciones IA por decisión", desc: "Claude justifica priorizaciones, alertas y campañas", icon: "💬", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "expiration_predict", name: "Predicción de mermas", desc: "Estima riesgo de pérdida por caducidad usando los lotes FEFO", icon: "🔮", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "seguridad",
      name: "Seguridad · Loss Prevention",
      desc: "Cámaras + IA detectan robos y comportamientos sospechosos",
      icon: "🛡️",
      color: "#7E2820",
      features: [
        { id: "security_ai", name: "IA en cámaras · alertas en vivo", desc: "Claude Vision detecta papel en blanco, robo de insumos, caja abierta sin tx", icon: "📹", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "security_evidence", name: "Bitácora con evidencia visual", desc: "Cada alerta tiene snapshot + clip 30s + razón IA documentada", icon: "📸", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "security_review_workflow", name: "Workflow de revisión", desc: "Confirmar · Descartar · Escalar con notas y seguimiento", icon: "🔍", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "security_reports", name: "Reportes de mermas", desc: "Cuantifica pérdidas por tipo de incidente y por empleado", icon: "📊", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "security_multi_camera", name: "Cámaras ilimitadas + multi-local", desc: "Profesional: 4 cámaras por local · Enterprise: ilimitadas", icon: "🎥", plans: ["ENTERPRISE"] }
      ]
    },
    {
      id: "escalamiento",
      name: "Multi-local y operación",
      desc: "Crece sin migrar de sistema",
      icon: "🏬",
      color: "#3B82F6",
      features: [
        { id: "multi_location", name: "Multi-local consolidado", desc: "Operación de hasta 15 locales con P&L por local", icon: "🌐", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "audit_log", name: "Auditoría completa", desc: "Trazabilidad de todos los cambios críticos del sistema", icon: "🔒", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "multi_ruc", name: "Multi-RUC / holding", desc: "Operación corporativa con varias razones sociales", icon: "🏛️", plans: ["ENTERPRISE"] },
        { id: "transfers", name: "Transferencias entre locales", desc: "Movimiento de insumos entre sedes con kardex automático", icon: "🔁", plans: ["ENTERPRISE"] },
        { id: "central_purchases", name: "Compras centralizadas", desc: "Una orden de compra para todos los locales", icon: "📦", plans: ["ENTERPRISE"] },
        { id: "partners_program", name: "Implementadores certificados", desc: "Red de partners para rollouts multi-local", icon: "🤝", plans: ["ENTERPRISE"] },
        { id: "priority_support", name: "Soporte priority", desc: "Canal directo · respuesta < 4 horas hábiles", icon: "📞", plans: ["ENTERPRISE"] },
        { id: "custom_features", name: "Personalización del producto", desc: "Bolsa mensual de horas para ajustes a medida", icon: "⚙️", plans: ["ENTERPRISE"] }
      ]
    }
  ];

  // ─── PUBLIC API ──────────────────────────────────────────
  const STORAGE_KEY = "mesasmart_active_plan";
  const STORAGE_CTX = "mesasmart_consultant_context";
  const STORAGE_RESTAURANT = "mesasmart_active_restaurant";

  // Demo: lista de restaurantes para clientes Profesional/Enterprise multi-local
  // En producción esto se carga desde el backend (/api/multi/restaurants)
  const DEMO_RESTAURANTS = [
    {
      id: "labrasa-miraflores",
      name: "La Brasa Dorada · Miraflores",
      shortName: "Miraflores",
      address: "Av. Larco 845, Miraflores",
      ruc: "20512345678",
      phone: "+51 1 445 6789",
      manager: "Marcos Vidal",
      status: "OPEN",
      tables: 28,
      occupancyPct: 71,
      openOrders: 14,
      salesTodayCents: 482600,
      pendingAlerts: 3,
      criticalAlerts: 1,
      monthRevenue: 14820000,
      monthMargin: 0.236,
      avgTicketCents: 8550,
      coverImg: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=70",
      isFlagship: true
    },
    {
      id: "labrasa-sanisidro",
      name: "La Brasa Dorada · San Isidro",
      shortName: "San Isidro",
      address: "Av. Pardo y Aliaga 695, San Isidro",
      ruc: "20512345678",
      phone: "+51 1 422 1100",
      manager: "Patricia Lozano",
      status: "OPEN",
      tables: 22,
      occupancyPct: 55,
      openOrders: 9,
      salesTodayCents: 312800,
      pendingAlerts: 2,
      criticalAlerts: 0,
      monthRevenue: 9650000,
      monthMargin: 0.218,
      avgTicketCents: 7900,
      coverImg: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=70",
      isFlagship: false
    },
    {
      id: "labrasa-surco",
      name: "La Brasa Dorada · Surco",
      shortName: "Surco",
      address: "Av. Caminos del Inca 2510, Surco",
      ruc: "20512345678",
      phone: "+51 1 372 4500",
      manager: "Diego Camacho",
      status: "OPEN",
      tables: 18,
      occupancyPct: 44,
      openOrders: 6,
      salesTodayCents: 245100,
      pendingAlerts: 4,
      criticalAlerts: 2,
      monthRevenue: 7820000,
      monthMargin: 0.194,
      avgTicketCents: 7200,
      coverImg: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=70",
      isFlagship: false
    },
    {
      id: "labrasa-callao",
      name: "La Brasa Dorada · Callao Express",
      shortName: "Callao Express",
      address: "Aeropuerto Jorge Chávez · Salida T1",
      ruc: "20512345678",
      phone: "+51 1 517 3300",
      manager: "Lucía Rivas",
      status: "OPEN",
      tables: 12,
      occupancyPct: 83,
      openOrders: 11,
      salesTodayCents: 198400,
      pendingAlerts: 1,
      criticalAlerts: 0,
      monthRevenue: 5430000,
      monthMargin: 0.282,
      avgTicketCents: 5400,
      coverImg: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=70",
      isFlagship: false
    }
  ];

  // Demo: matriz de permisos usuario × restaurante
  const DEMO_TEAM_ACCESS = [
    { user: "Marcos Vidal", email: "marcos@labrasa.pe", roles: { "labrasa-miraflores": "ADMIN", "labrasa-sanisidro": "ADMIN", "labrasa-surco": "ADMIN", "labrasa-callao": "ADMIN" }, isOwner: true },
    { user: "Patricia Lozano", email: "patricia@labrasa.pe", roles: { "labrasa-sanisidro": "ADMIN", "labrasa-miraflores": "READ_ONLY" } },
    { user: "Diego Camacho", email: "diego@labrasa.pe", roles: { "labrasa-surco": "ADMIN" } },
    { user: "Lucía Rivas", email: "lucia@labrasa.pe", roles: { "labrasa-callao": "ADMIN" } },
    { user: "María Quispe", email: "maria@labrasa.pe", roles: { "labrasa-miraflores": "WAITER" } },
    { user: "Juan Cárdenas", email: "juan@labrasa.pe", roles: { "labrasa-miraflores": "WAITER", "labrasa-sanisidro": "WAITER" } },
    { user: "Enrique Ruiz", email: "cocina@labrasa.pe", roles: { "labrasa-miraflores": "KITCHEN" } },
    { user: "Lucía Vargas", email: "caja@labrasa.pe", roles: { "labrasa-miraflores": "CASHIER", "labrasa-sanisidro": "CASHIER" } }
  ];

  function activePlanId() {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Migración: si quedó "POS_SOLO" en storage, lo subimos a OPERACION
    if (stored === "POS_SOLO") {
      localStorage.setItem(STORAGE_KEY, "OPERACION");
      return "OPERACION";
    }
    return stored || "PROFESIONAL"; // demo default
  }

  function activePlan() {
    return PLANS[activePlanId()] || PLANS.PROFESIONAL;
  }

  function setActivePlan(planId, context) {
    if (!PLANS[planId]) return false;
    localStorage.setItem(STORAGE_KEY, planId);
    if (context) localStorage.setItem(STORAGE_CTX, JSON.stringify(context));
    window.dispatchEvent(new CustomEvent("mesasmart:plan-changed", { detail: { planId, plan: PLANS[planId] } }));
    return true;
  }

  function getConsultantContext() {
    try { return JSON.parse(localStorage.getItem(STORAGE_CTX) || "null"); }
    catch { return null; }
  }

  function isEnabled(featureId) {
    const plan = activePlanId();
    for (const group of FEATURE_GROUPS) {
      const f = group.features.find(x => x.id === featureId);
      if (f) return f.plans.includes(plan);
    }
    return true; // si no está en el catálogo, default permitido
  }

  function getFeature(featureId) {
    for (const group of FEATURE_GROUPS) {
      const f = group.features.find(x => x.id === featureId);
      if (f) return f;
    }
    return null;
  }

  function planIncludes(planId, featureId) {
    const f = getFeature(featureId);
    return f ? f.plans.includes(planId) : false;
  }

  /**
   * Helper para ocultar elementos en cada vista según el plan.
   * Usar `data-feature="featureId"` en el HTML — si la feature no está
   * incluida, el elemento queda con clase `feature-locked` que muestra
   * un overlay con CTA de upgrade.
   */
  function applyFeatureGates(rootEl) {
    const root = rootEl || document;
    const elements = root.querySelectorAll("[data-feature]");
    elements.forEach(el => {
      const featureId = el.getAttribute("data-feature");
      if (!isEnabled(featureId)) {
        el.classList.add("feature-locked");
        if (!el.querySelector(".feature-lock-overlay")) {
          const overlay = document.createElement("div");
          overlay.className = "feature-lock-overlay";
          const f = getFeature(featureId);
          const requiredPlan = f && f.plans.length > 0 ? PLANS[f.plans[0]] : null;
          overlay.innerHTML = `
            <div class="feature-lock-card">
              <div class="feature-lock-icon">🔒</div>
              <p class="feature-lock-title">Disponible en ${requiredPlan ? requiredPlan.name : "plan superior"}</p>
              <p class="feature-lock-desc">${f ? f.desc : ""}</p>
              <button class="feature-lock-cta" onclick="window.MesaSmartFeatures.openUpgrade('${featureId}')">Upgrade · ver planes</button>
            </div>
          `;
          el.appendChild(overlay);
        }
      } else {
        el.classList.remove("feature-locked");
        const overlay = el.querySelector(".feature-lock-overlay");
        if (overlay) overlay.remove();
      }
    });
  }

  function openUpgrade(featureId) {
    // Redirige al hub a la sección consultor
    window.location.href = "./index.html#consultor";
  }

  // Inyecta CSS global para el lock overlay
  function injectLockStyles() {
    if (document.getElementById("mesasmart-feature-lock-styles")) return;
    const style = document.createElement("style");
    style.id = "mesasmart-feature-lock-styles";
    style.textContent = `
      [data-feature].feature-locked {
        position: relative !important;
        overflow: hidden;
      }
      .feature-lock-overlay {
        position: absolute; inset: 0;
        background: rgba(31,26,23,0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10;
        border-radius: inherit;
      }
      .feature-lock-card {
        background: white;
        border: 1px solid #E8DFD3;
        border-radius: 16px;
        padding: 20px;
        max-width: 320px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0,0,0,0.20);
      }
      .feature-lock-icon { font-size: 32px; margin-bottom: 8px; }
      .feature-lock-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #2A1F1A; }
      .feature-lock-desc { font-size: 13px; color: #6B5D52; margin-top: 6px; }
      .feature-lock-cta {
        margin-top: 14px;
        padding: 10px 20px;
        background: linear-gradient(135deg, #A0322B 0%, #C8941F 100%);
        color: white;
        border: none;
        border-radius: 100px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 6px 16px rgba(160,50,43,0.30);
      }
      .feature-lock-cta:hover { transform: translateY(-1px); }
    `;
    document.head.appendChild(style);
  }

  // Auto-inject en DOM ready
  let _observer = null;
  function _bootObserver() {
    if (_observer || typeof MutationObserver === "undefined") return;
    _observer = new MutationObserver((mutations) => {
      let needsScan = false;
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.hasAttribute && n.hasAttribute("data-feature")) { needsScan = true; break; }
            if (n.querySelector && n.querySelector("[data-feature]")) { needsScan = true; break; }
          }
        }
        if (needsScan) break;
      }
      if (needsScan) applyFeatureGates();
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        injectLockStyles();
        applyFeatureGates();
        _bootObserver();
      });
    } else {
      injectLockStyles();
      applyFeatureGates();
      _bootObserver();
    }

    // Re-aplicar cuando cambie el plan
    window.addEventListener("mesasmart:plan-changed", () => applyFeatureGates());
  }

  // Banner top que muestra el plan activo
  function renderPlanBanner(targetSelector) {
    const target = document.querySelector(targetSelector || "body");
    if (!target) return;
    const existing = document.getElementById("mesasmart-plan-banner");
    if (existing) existing.remove();
    const plan = activePlan();
    const banner = document.createElement("div");
    banner.id = "mesasmart-plan-banner";
    banner.style.cssText = `position:fixed;bottom:16px;left:16px;z-index:9998;background:white;border:1px solid #E8DFD3;border-left:4px solid ${plan.color};border-radius:12px;padding:10px 14px;font-family:Inter,sans-serif;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);display:flex;align-items:center;gap:10px;cursor:pointer;`;
    banner.innerHTML = `
      <div style="font-weight:600;color:${plan.color};">Plan ${plan.name}</div>
      <a href="./index.html#consultor" style="color:#6B5D52;text-decoration:none;font-size:11px;">Cambiar →</a>
    `;
    target.appendChild(banner);
  }

  // ─── Multi-restaurante (Profesional/Enterprise) ───────────
  function listRestaurants() {
    // En producción: fetch /api/multi/restaurants
    return DEMO_RESTAURANTS.slice();
  }

  function activeRestaurantId() {
    return localStorage.getItem(STORAGE_RESTAURANT) || DEMO_RESTAURANTS[0].id;
  }

  function activeRestaurant() {
    const id = activeRestaurantId();
    return DEMO_RESTAURANTS.find(r => r.id === id) || DEMO_RESTAURANTS[0];
  }

  function setActiveRestaurant(restaurantId) {
    if (!DEMO_RESTAURANTS.find(r => r.id === restaurantId)) return false;
    localStorage.setItem(STORAGE_RESTAURANT, restaurantId);
    window.dispatchEvent(new CustomEvent("mesasmart:restaurant-changed", {
      detail: { restaurantId, restaurant: activeRestaurant() }
    }));
    return true;
  }

  function teamAccess() {
    return DEMO_TEAM_ACCESS.slice();
  }

  /**
   * Renderiza una píldora compacta arriba que muestra el restaurante activo
   * y un botón para volver al multi-view. Se inserta automáticamente en la vista
   * cuando el plan incluye multi_location.
   */
  function renderRestaurantSwitcher() {
    if (!isEnabled("multi_location")) return; // solo Profesional+
    if (document.getElementById("mesasmart-rest-switcher")) return;
    const r = activeRestaurant();
    const wrap = document.createElement("div");
    wrap.id = "mesasmart-rest-switcher";
    wrap.style.cssText = `
      position: fixed; top: 14px; right: 14px; z-index: 9997;
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.96);
      border: 1px solid #E8DFD3;
      border-left: 4px solid #A0322B;
      border-radius: 12px;
      padding: 8px 12px 8px 14px;
      font-family: Inter, sans-serif;
      font-size: 12px;
      box-shadow: 0 6px 18px rgba(31,26,23,0.10);
      backdrop-filter: blur(12px);
    `;
    wrap.innerHTML = `
      <div style="display:flex;flex-direction:column;line-height:1.2;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#6B5D52;font-weight:700;">Local activo</span>
        <span style="font-size:13px;font-weight:600;color:#2A1F1A;">${r.shortName}</span>
      </div>
      <a href="./multi.html" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:#A0322B;color:white;text-decoration:none;border-radius:50%;font-size:14px;font-weight:700;" title="Cambiar de local · ver multi-vista">⇄</a>
    `;
    document.body.appendChild(wrap);
  }

  window.MesaSmartFeatures = {
    PLANS,
    FEATURE_GROUPS,
    activePlanId,
    activePlan,
    setActivePlan,
    getConsultantContext,
    isEnabled,
    getFeature,
    planIncludes,
    applyFeatureGates,
    openUpgrade,
    renderPlanBanner,
    // Multi-restaurante
    listRestaurants,
    activeRestaurantId,
    activeRestaurant,
    setActiveRestaurant,
    teamAccess,
    renderRestaurantSwitcher
  };

  // Auto-render del switcher en cada vista (excepto multi.html y index.html)
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        const path = window.location.pathname;
        if (!path.match(/\/(multi|index|partners|PITCH)\.html$/) && !path.match(/\/$/)) {
          renderRestaurantSwitcher();
        }
      });
    } else {
      const path = window.location.pathname;
      if (!path.match(/\/(multi|index|partners|PITCH)\.html$/) && !path.match(/\/$/)) {
        renderRestaurantSwitcher();
      }
    }
  }
})();
