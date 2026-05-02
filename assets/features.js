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
        { id: "smart_priority", name: "Smart Priority cocina", desc: "Algoritmo prioriza tickets en KDS", icon: "⚡", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "ai_assistant_waiter", name: "Asistente IA mozo", desc: "Sugiere acciones en tiempo real", icon: "🧭", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "ai_explanations", name: "Explicaciones IA por decisión", desc: "Claude justifica priorizaciones, alertas y campañas", icon: "💬", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "expiration_predict", name: "Predicción de mermas", desc: "IA estima riesgo de pérdida por caducidad", icon: "🔮", plans: ["PROFESIONAL", "ENTERPRISE"] }
      ]
    },
    {
      id: "ia_avanzada_enterprise",
      name: "IA avanzada · Enterprise",
      desc: "Modelos de forecasting y optimización a escala",
      icon: "🧠",
      color: "#7C3AED",
      enterpriseOnly: true,
      features: [
        { id: "forecast_demand_ai", name: "Forecast de demanda 14 días", desc: "Predice ventas por local/hora con histórico + clima + feriados", icon: "📈", plans: ["ENTERPRISE"] },
        { id: "staff_optimizer_ai", name: "Optimización de turnos IA", desc: "Sugiere staffing óptimo por local según forecast", icon: "🗓️", plans: ["ENTERPRISE"] },
        { id: "menu_engineering_ai", name: "Menu engineering IA", desc: "Clasifica platos en stars/dogs · sugiere precios", icon: "📊", plans: ["ENTERPRISE"] },
        { id: "anomaly_detection", name: "Detección de anomalías", desc: "Alerta automática si fuga de stock o caídas de venta", icon: "🚨", plans: ["ENTERPRISE"] },
        { id: "fine_tune_brand", name: "IA fine-tuned a tu marca", desc: "Modelo entrenado con tus recetas, voz y políticas", icon: "🎯", plans: ["ENTERPRISE"] }
      ]
    },
    {
      id: "escalamiento",
      name: "Multi-local y operación",
      desc: "Crece sin migrar de sistema",
      icon: "🏬",
      color: "#3B82F6",
      features: [
        { id: "multi_location", name: "Multi-local consolidado", desc: "P&L por local + comparativos", icon: "🌐", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "audit_log", name: "Auditoría completa", desc: "Trazabilidad de todos los cambios", icon: "🔒", plans: ["PROFESIONAL", "ENTERPRISE"] },
        { id: "transfers", name: "Transferencias entre locales", desc: "Mueve insumos · contabiliza autom.", icon: "🔁", plans: ["ENTERPRISE"] },
        { id: "central_purchases", name: "Compras centralizadas", desc: "1 PO para todos los locales", icon: "📦", plans: ["ENTERPRISE"] },
        { id: "central_kitchen", name: "Cocina central / commissary", desc: "Producción centralizada → distribución a locales", icon: "🏭", plans: ["ENTERPRISE"] },
        { id: "consolidated_pnl", name: "P&L consolidado de holding", desc: "Reporte agregado para directorio · multi-RUC", icon: "🏛️", plans: ["ENTERPRISE"] },
        { id: "exec_reports", name: "Reportes ejecutivos al directorio", desc: "PDF mensual automático con KPIs por local", icon: "📑", plans: ["ENTERPRISE"] }
      ]
    },
    {
      id: "gobierno",
      name: "Gobierno corporativo",
      desc: "Lo que el área de TI/Compliance va a pedir",
      icon: "🛡️",
      color: "#1F1A17",
      enterpriseOnly: true,
      features: [
        { id: "sso_saml", name: "SSO · SAML / OIDC", desc: "Login con Google Workspace, Azure AD, Okta", icon: "🔐", plans: ["ENTERPRISE"] },
        { id: "granular_roles", name: "Roles y permisos granulares", desc: "Define permisos al nivel de campo/acción", icon: "🧩", plans: ["ENTERPRISE"] },
        { id: "ip_allowlist", name: "Restricciones por IP", desc: "Solo se accede desde tus oficinas/locales", icon: "🌐", plans: ["ENTERPRISE"] },
        { id: "data_residency", name: "Backup diario + retención 7 años", desc: "Cumple SUNAT · backup encriptado", icon: "💾", plans: ["ENTERPRISE"] },
        { id: "sla_99_9", name: "SLA 99.9% con créditos", desc: "Compromiso contractual · créditos automáticos", icon: "📜", plans: ["ENTERPRISE"] },
        { id: "white_label", name: "White-label opcional", desc: "Branding propio · logo · dominio custom", icon: "🎨", plans: ["ENTERPRISE"] },
        { id: "dedicated_environment", name: "Ambiente dedicado", desc: "Base de datos aislada · no shared tenancy", icon: "🏗️", plans: ["ENTERPRISE"] }
      ]
    },
    {
      id: "integraciones",
      name: "Integraciones corporativas",
      desc: "Conecta con tu stack contable, BI y bancario",
      icon: "🔌",
      color: "#2D7D5A",
      enterpriseOnly: true,
      features: [
        { id: "api_webhooks", name: "API REST + Webhooks", desc: "Endpoints abiertos para tus sistemas internos", icon: "🛜", plans: ["ENTERPRISE"] },
        { id: "concar_export", name: "Export a Concar / SAP / Siigo", desc: "Asientos contables generados automáticamente", icon: "📤", plans: ["ENTERPRISE"] },
        { id: "bi_export", name: "Conector Power BI / Tableau", desc: "Dataset directo para tu equipo de analytics", icon: "📊", plans: ["ENTERPRISE"] },
        { id: "bank_reconciliation", name: "Conciliación bancaria automática", desc: "Cruza cuentas BCP/BBVA/Interbank con caja", icon: "🏦", plans: ["ENTERPRISE"] },
        { id: "delivery_aggregators", name: "Integración Rappi / PedidosYa", desc: "Pedidos y stock sincronizados con apps", icon: "🛵", plans: ["ENTERPRISE"] },
        { id: "loyalty_integration", name: "Integración con CRM externo", desc: "HubSpot, Salesforce, Mailchimp", icon: "🔗", plans: ["ENTERPRISE"] }
      ]
    },
    {
      id: "soporte_enterprise",
      name: "Soporte Enterprise",
      desc: "Acompañamiento humano dedicado",
      icon: "🤝",
      color: "#C8941F",
      enterpriseOnly: true,
      features: [
        { id: "csm_dedicated", name: "Customer Success Manager dedicado", desc: "Una persona asignada a tu cuenta", icon: "👤", plans: ["ENTERPRISE"] },
        { id: "priority_support", name: "Soporte priority 24/7", desc: "Respuesta < 1 hora · canal directo Slack/WhatsApp", icon: "📞", plans: ["ENTERPRISE"] },
        { id: "quarterly_review", name: "Quarterly business review", desc: "Reunión trimestral revisión KPIs y roadmap", icon: "🔭", plans: ["ENTERPRISE"] },
        { id: "training_recurring", name: "Capacitación recurrente", desc: "Onboarding inicial + refrescos para nuevo staff", icon: "🎓", plans: ["ENTERPRISE"] },
        { id: "partners_program", name: "Implementadores certificados", desc: "Red de partners para tu rollout multi-local", icon: "🛠️", plans: ["ENTERPRISE"] },
        { id: "custom_dev_hours", name: "Horas de desarrollo custom", desc: "Bolsa mensual para integraciones a medida", icon: "⚙️", plans: ["ENTERPRISE"] }
      ]
    }
  ];

  // ─── PUBLIC API ──────────────────────────────────────────
  const STORAGE_KEY = "mesasmart_active_plan";
  const STORAGE_CTX = "mesasmart_consultant_context";

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
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        injectLockStyles();
        applyFeatureGates();
      });
    } else {
      injectLockStyles();
      applyFeatureGates();
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
    renderPlanBanner
  };
})();
