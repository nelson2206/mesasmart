/**
 * MesaSmart · Cliente API compartido
 * ──────────────────────────────────────
 * Módulo único para que cualquier vista (cliente, cocina, admin, mozo, ERP)
 * se conecte al backend MesaSmart vía HTTP + Socket.io.
 *
 * Uso:
 *   <script src="./assets/api.js"></script>
 *   const api = window.MesaSmartAPI;
 *   api.configure({ baseUrl: 'https://mesasmart-backend.onrender.com' });
 *   const { token, user } = await api.login('admin@labrasa.pe', 'demo1234');
 *   const tables = await api.tables.list();
 *
 * Auto-detecta backend URL desde:
 *   1. localStorage.mesasmart_backend_url (manual override)
 *   2. window.MESASMART_BACKEND_URL (si lo seteas en HTML)
 *   3. fallback: prompt al usuario en primer login
 */

(function () {
  const STORAGE_TOKEN = "mesasmart_token";
  const STORAGE_USER = "mesasmart_user";
  const STORAGE_BACKEND = "mesasmart_backend_url";

  let baseUrl = localStorage.getItem(STORAGE_BACKEND) ||
                window.MESASMART_BACKEND_URL ||
                "";
  let token = localStorage.getItem(STORAGE_TOKEN) || null;
  let socket = null;

  // ─── Helpers ───────────────────────────────────────────
  async function request(method, path, body) {
    if (!baseUrl) throw new Error("Backend URL no configurado. Llama a api.configure({baseUrl})");
    const url = baseUrl.replace(/\/$/, "") + path;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "omit"
    });
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ─── Socket.io ─────────────────────────────────────────
  function connectSocket() {
    if (!baseUrl || !token) return null;
    if (socket) return socket;
    if (typeof io === "undefined") {
      console.warn("[MesaSmartAPI] socket.io-client no cargado. Añade <script src='https://cdn.socket.io/4.7.5/socket.io.min.js'></script>");
      return null;
    }
    socket = io(baseUrl, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => console.log("[MesaSmartAPI] Socket conectado:", socket.id));
    socket.on("connect_error", (e) => console.warn("[MesaSmartAPI] Socket error:", e.message));
    return socket;
  }

  // ─── API ───────────────────────────────────────────────
  const api = {
    configure(opts) {
      if (opts.baseUrl) {
        baseUrl = opts.baseUrl.replace(/\/$/, "");
        localStorage.setItem(STORAGE_BACKEND, baseUrl);
      }
    },
    getBaseUrl() { return baseUrl; },
    isConfigured() { return Boolean(baseUrl); },
    isAuthenticated() { return Boolean(token); },
    getToken() { return token; },
    getUser() {
      try { return JSON.parse(localStorage.getItem(STORAGE_USER) || "null"); }
      catch { return null; }
    },

    async login(email, password) {
      const data = await request("POST", "/api/auth/login", { email, password });
      token = data.token;
      localStorage.setItem(STORAGE_TOKEN, token);
      localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
      connectSocket();
      return data;
    },
    logout() {
      token = null;
      localStorage.removeItem(STORAGE_TOKEN);
      localStorage.removeItem(STORAGE_USER);
      if (socket) { socket.disconnect(); socket = null; }
    },
    me() { return request("GET", "/api/auth/me"); },

    // Mesas
    tables: {
      list: () => request("GET", "/api/tables"),
      get: (id) => request("GET", `/api/tables/${id}`),
      update: (id, patch) => request("PATCH", `/api/tables/${id}`, patch),
      call: (id, reason, urgent = false) => request("POST", `/api/tables/${id}/call`, { reason, urgent }),
      byQrToken: (qr) => request("GET", `/api/tables/qr/${qr}`)
    },

    // Menú
    menu: {
      categories: () => request("GET", "/api/menu/categories"),
      items: (filters = {}) => {
        const q = new URLSearchParams(filters).toString();
        return request("GET", `/api/menu/items${q ? "?" + q : ""}`);
      },
      item: (id) => request("GET", `/api/menu/items/${id}`),
      setAvailability: (id, available) => request("PATCH", `/api/menu/items/${id}/availability`, { available })
    },

    // Órdenes
    orders: {
      create: (payload) => request("POST", "/api/orders", payload),
      get: (id) => request("GET", `/api/orders/${id}`),
      active: () => request("GET", "/api/orders/active"),
      update: (id, patch) => request("PATCH", `/api/orders/${id}`, patch),
      addItems: (id, items) => request("POST", `/api/orders/${id}/items`, { items }),
      advance: (orderId, itemId) => request("POST", `/api/orders/${orderId}/items/${itemId}/advance`),
      checkout: (id, tipPct = 0.1) => request("POST", `/api/orders/${id}/checkout`, { tipPct }),
      bump: (id) => request("POST", `/api/orders/${id}/bump`),
      priority: (id, explain = false) => request("GET", `/api/orders/${id}/priority${explain ? "?explain=true" : ""}`),
      topRecommendation: () => request("GET", "/api/orders/priority/recommendation")
    },

    // Modificaciones
    modifications: {
      request: (orderId, itemId, reason, note) =>
        request("POST", `/api/orders/${orderId}/items/${itemId}/modifications`, { reason, note }),
      resolve: (modId, status, kitchenNote) =>
        request("PATCH", `/api/modifications/${modId}`, { status, kitchenNote }),
      pending: () => request("GET", "/api/modifications/pending")
    },

    // Llamados al mozo
    calls: {
      active: () => request("GET", "/api/calls/active"),
      resolve: (id) => request("PATCH", `/api/calls/${id}/resolve`)
    },

    // Pago + comprobante
    payments: {
      pay: (orderId, payload) => request("POST", `/api/orders/${orderId}/payment`, payload),
      comprobante: (id) => request("GET", `/api/comprobantes/${id}`)
    },

    // Reportes
    reports: {
      dashboard: () => request("GET", "/api/reports/dashboard"),
      sales: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request("GET", `/api/reports/sales${q ? "?" + q : ""}`);
      },
      topItems: (limit = 10) => request("GET", `/api/reports/top-items?limit=${limit}`),
      pnl: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request("GET", `/api/pnl${q ? "?" + q : ""}`);
      }
    },

    // ERP
    ingredients: {
      list: (filters = {}) => {
        const q = new URLSearchParams(filters).toString();
        return request("GET", `/api/ingredients${q ? "?" + q : ""}`);
      },
      get: (id) => request("GET", `/api/ingredients/${id}`),
      categories: () => request("GET", "/api/ingredients/categories"),
      movements: (id, limit = 50) => request("GET", `/api/ingredients/${id}/movements?limit=${limit}`),
      adjust: (id, newQty, reason) => request("POST", `/api/ingredients/${id}/adjust`, { newQty, reason }),
      restockAlerts: () => request("GET", "/api/ingredients/alerts/restock"),
      expiringAlerts: (days = 5) => request("GET", `/api/ingredients/alerts/expiring?days=${days}`)
    },
    inventory: {
      summary: () => request("GET", "/api/inventory/summary"),
      counts: () => request("GET", "/api/inventory/counts"),
      count: (id) => request("GET", `/api/inventory/counts/${id}`),
      startCount: (scope = "FULL", ingredientIds) => request("POST", "/api/inventory/counts", { scope, ingredientIds }),
      updateLine: (countId, lineId, actualQty, notes) =>
        request("PATCH", `/api/inventory/counts/${countId}/lines/${lineId}`, { actualQty, notes }),
      complete: (countId) => request("POST", `/api/inventory/counts/${countId}/complete`),
      photoCount: (imageBase64, imageMediaType = "image/jpeg", context, ingredientIds) =>
        request("POST", "/api/inventory/counts/photo", { imageBase64, imageMediaType, context, ingredientIds }),
      movements: (filters = {}) => {
        const q = new URLSearchParams(filters).toString();
        return request("GET", `/api/inventory/movements${q ? "?" + q : ""}`);
      }
    },
    recipes: {
      forMenuItem: (id) => request("GET", `/api/menu-items/${id}/recipe`),
      set: (menuItemId, ingredients) => request("PUT", `/api/menu-items/${menuItemId}/recipe`, { ingredients }),
      coverage: () => request("GET", "/api/coverage")
    },
    suppliers: {
      list: () => request("GET", "/api/suppliers"),
      autoRestock: () => request("POST", "/api/suppliers/auto-restock"),
      purchaseOrders: (status) => request("GET", `/api/suppliers/purchase-orders${status ? "?status=" + status : ""}`),
      send: (poId) => request("POST", `/api/suppliers/purchase-orders/${poId}/send`),
      receive: (poId, lines) => request("POST", `/api/suppliers/purchase-orders/${poId}/receive`, { lines })
    },
    campaigns: {
      list: (status) => request("GET", `/api/campaigns${status ? "?status=" + status : ""}`),
      generate: () => request("POST", "/api/campaigns/generate"),
      update: (id, status) => request("PATCH", `/api/campaigns/${id}`, { status })
    },

    // Público (cliente con qrToken, sin auth)
    public: {
      session: (qrToken = "demo") => request("GET", `/api/public/session/${qrToken}`),
      createOrder: (qrToken, partySize, items) =>
        request("POST", "/api/public/orders", { qrToken, partySize, items }),
      getOrder: (id, qrToken) => request("GET", `/api/public/orders/${id}?qrToken=${qrToken}`),
      requestModification: (orderId, itemId, qrToken, reason, note) =>
        request("POST", `/api/public/orders/${orderId}/items/${itemId}/modifications`, { qrToken, reason, note }),
      callWaiter: (qrToken, reason, urgent = false) =>
        request("POST", "/api/public/calls", { qrToken, reason, urgent }),
      checkout: (orderId, qrToken, tipPct = 0.10) =>
        request("POST", `/api/public/orders/${orderId}/checkout`, { qrToken, tipPct }),

      // Customer identification + recurring rewards
      identifyCustomer: (qrToken, { email, dni, phone, name }) =>
        request("POST", "/api/public/customer/identify", { qrToken, email, dni, phone, name }),
      registerCustomerVisit: (customerId, orderId, spentCents) =>
        request("POST", "/api/public/customer/register-visit", { customerId, orderId, spentCents }),
      applyCustomerReward: (qrToken, customerId, orderId) =>
        request("POST", "/api/public/customer/apply-reward", { qrToken, customerId, orderId })
    },

    // AI
    ai: {
      status: () => request("GET", "/api/ai/status"),
      explainPriority: (orderId) => request("GET", `/api/ai/explain-priority/${orderId}`),
      suggestSequence: (station = "brasa") => request("GET", `/api/ai/suggest-sequence?station=${station}`),
      classifyComplaint: (complaintText) => request("POST", "/api/ai/classify-complaint", { complaintText }),
      translate: (text, lang) => request("POST", "/api/ai/translate", { text, lang }),
      recommend: (cartItemNames) => request("POST", "/api/ai/recommend", { cartItemNames })
    },

    // Sockets
    socket: () => connectSocket(),
    disconnect: () => { if (socket) { socket.disconnect(); socket = null; } }
  };

  // Auto-connect socket if already authenticated on page load
  if (token && baseUrl && typeof io !== "undefined") {
    setTimeout(connectSocket, 100);
  }

  window.MesaSmartAPI = api;
})();
