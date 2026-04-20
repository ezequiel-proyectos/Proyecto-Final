const router = require("express").Router();
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");
const { getPool } = require("../db");
const { validate } = require("../middleware");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Token inválido" }); }
}

// Simula un procesador de pagos externo
function simulatePaymentProcessor(method, amount) {
  // 90% de éxito para card/wallet, 100% para efectivo
  if (method === "cash") return { success: true, transaction_id: `CASH-${Date.now()}` };
  const success = Math.random() > 0.1;
  return {
    success,
    transaction_id: success ? `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : null,
  };
}

// ── POST /payments  (iniciar pago de un pedido) ───────────────────
router.post(
  "/",
  authMiddleware,
  [
    body("order_id").isInt({ min: 1 }).withMessage("order_id inválido"),
    body("amount").isFloat({ min: 0.01 }).withMessage("amount inválido"),
    body("method").isIn(["card", "cash", "wallet"]).withMessage("method debe ser card, cash o wallet"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { order_id, amount, method } = req.body;
      const pool = await getPool();

      // Verificar que no existe un pago aprobado para esta orden
      const [[existing]] = await pool.execute(
        "SELECT id, status FROM payments WHERE order_id=?",
        [order_id]
      );
      if (existing && existing.status === "approved") {
        return res.status(409).json({ error: "Esta orden ya tiene un pago aprobado" });
      }

      // Procesar con el simulador
      const result = simulatePaymentProcessor(method, amount);
      const status = result.success ? "approved" : "rejected";

      let paymentId;
      if (existing) {
        // Reintentar pago rechazado
        await pool.execute(
          "UPDATE payments SET status=?, transaction_id=?, method=?, updated_at=NOW() WHERE id=?",
          [status, result.transaction_id, method, existing.id]
        );
        paymentId = existing.id;
      } else {
        const [ins] = await pool.execute(
          "INSERT INTO payments (order_id, user_id, amount, method, status, transaction_id) VALUES (?,?,?,?,?,?)",
          [order_id, req.user.id, amount, method, status, result.transaction_id]
        );
        paymentId = ins.insertId;
      }

      res.status(result.success ? 200 : 402).json({
        id: paymentId,
        order_id,
        status,
        transaction_id: result.transaction_id,
        message: result.success ? "Pago procesado correctamente" : "Pago rechazado, intente nuevamente",
      });
    } catch (err) { next(err); }
  }
);

// ── GET /payments/order/:order_id ─────────────────────────────────
router.get("/order/:order_id", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[payment]] = await pool.execute(
      "SELECT * FROM payments WHERE order_id=?",
      [req.params.order_id]
    );
    if (!payment) return res.status(404).json({ error: "Pago no encontrado para esta orden" });
    res.json(payment);
  } catch (err) { next(err); }
});

// ── GET /payments/:id ─────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id=?", [req.params.id]);
    if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
    if (payment.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    res.json(payment);
  } catch (err) { next(err); }
});

// ── POST /payments/:id/refund ─────────────────────────────────────
router.post("/:id/refund", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id=?", [req.params.id]);
    if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
    if (payment.status !== "approved") {
      return res.status(400).json({ error: "Solo se pueden reembolsar pagos aprobados" });
    }
    await pool.execute(
      "UPDATE payments SET status='refunded', updated_at=NOW() WHERE id=?",
      [payment.id]
    );
    res.json({ id: payment.id, status: "refunded", message: "Reembolso procesado" });
  } catch (err) { next(err); }
});

module.exports = router;
