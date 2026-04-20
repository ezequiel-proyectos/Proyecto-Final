const express = require("express");
const { register, httpMetrics } = require("./metrics");
const proxy = require("express-http-proxy");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// URLs de servicios internos
const SERVICES = {
  users:         process.env.USERS_SERVICE_URL         || "http://localhost:3001",
  catalog:       process.env.CATALOG_SERVICE_URL       || "http://localhost:3002",
  orders:        process.env.ORDERS_SERVICE_URL        || "http://localhost:3003",
  payments:      process.env.PAYMENTS_SERVICE_URL      || "http://localhost:3004",
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || "http://localhost:3005",
};

// ── Middlewares globales ──────────────────────────────────────────
app.use(morgan("[:date[clf]] :method :url :status :response-time ms"));
app.use(express.json());
app.use(httpMetrics);

// Rate limiter simple en memoria (por IP)
const requestCounts = new Map();
function rateLimiter(maxReq = 100, windowMs = 60_000) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = requestCounts.get(ip) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count++;
    requestCounts.set(ip, entry);
    if (entry.count > maxReq) {
      return res.status(429).json({ error: "Demasiadas solicitudes, espera un momento" });
    }
    next();
  };
}
app.use(rateLimiter(200, 60_000));

// ── Auth middleware (opcional por ruta) ───────────────────────────
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Autenticación requerida" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// ── Health del gateway ────────────────────────────────────────────
app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "api-gateway", services: Object.keys(SERVICES) }));

// ── Rutas públicas (sin auth) ─────────────────────────────────────
// Registro y login
app.use("/api/users/register", proxy(SERVICES.users, { proxyReqPathResolver: () => "/users/register" }));
app.use("/api/users/login",    proxy(SERVICES.users, { proxyReqPathResolver: () => "/users/login" }));

// Catálogo público (ver restaurantes y platos no requiere login)
app.use("/api/restaurants", proxy(SERVICES.catalog, {
  proxyReqPathResolver: (req) => `/restaurants${req.url === "/" ? "" : req.url}`,
}));
app.use("/api/dishes", proxy(SERVICES.catalog, {
  proxyReqPathResolver: (req) => `/dishes${req.url === "/" ? "" : req.url}`,
}));

// ── Rutas protegidas (requieren auth) ─────────────────────────────
// Perfil de usuario
app.use("/api/users", requireAuth, proxy(SERVICES.users, {
  proxyReqPathResolver: (req) => `/users${req.url === "/" ? "" : req.url}`,
}));

// Pedidos
app.use("/api/orders", requireAuth, proxy(SERVICES.orders, {
  proxyReqPathResolver: (req) => `/orders${req.url === "/" ? "" : req.url}`,
}));

// Pagos
app.use("/api/payments", requireAuth, proxy(SERVICES.payments, {
  proxyReqPathResolver: (req) => `/payments${req.url === "/" ? "" : req.url}`,
}));

// Notificaciones (uso interno pero expuesto para pruebas)
app.use("/api/notifications", requireAuth, proxy(SERVICES.notifications, {
  proxyReqPathResolver: (req) => `/notifications${req.url === "/" ? "" : req.url}`,
}));

// ── Ruta no encontrada ────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` }));

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[gateway-error]", err.message);
  res.status(500).json({ error: "Error interno del gateway" });
});

app.listen(PORT, () => {
  console.log(`[api-gateway] corriendo en puerto ${PORT}`);
  console.log("[api-gateway] servicios registrados:", SERVICES);
});
