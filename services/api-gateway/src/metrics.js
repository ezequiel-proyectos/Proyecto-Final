/**
 * metrics.js — Módulo compartido de métricas Prometheus
 * Usar en cada servicio: const { register, httpMetrics } = require('./metrics');
 *
 * Expone:
 *   - Métricas estándar de Node.js (CPU, memoria, event loop, GC)
 *   - http_requests_total        (contador por método, ruta, status)
 *   - http_request_duration_ms   (histograma de latencia)
 */

const client = require("prom-client");

// Registro global
const register = new client.Registry();

// Métricas por defecto de Node.js (memoria, CPU, event loop lag...)
client.collectDefaultMetrics({
  register,
  prefix: "nodejs_",
  labels: { service: process.env.SERVICE_NAME || "unknown" },
});

// ── Contador de requests HTTP ─────────────────────────────────────
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de solicitudes HTTP recibidas",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// ── Histograma de duración de requests ───────────────────────────
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duración de las solicitudes HTTP en segundos",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// ── Middleware Express que instrumenta todas las rutas ────────────
function httpMetrics(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    // Normalizar rutas con parámetros: /users/123 → /users/:id
    const route = req.route ? req.baseUrl + req.route.path : req.path;

    httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
    httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(duration);
  });

  next();
}

module.exports = { register, httpMetrics };
