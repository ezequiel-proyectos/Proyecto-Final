const router = require("express").Router();
const { body } = require("express-validator");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { getPool } = require("../db");
const { validate } = require("../middleware");

const CATALOG_URL = process.env.CATALOG_SERVICE_URL || "http://localhost:3002";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

const VALID_TRANSITIONS = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["preparing", "cancelled"],
  preparing:  ["on_the_way"],
  on_the_way: ["delivered"],
  delivered:  [],
  cancelled:  [],
};

function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ── POST /orders ──────────────────────────────────────────────────
router.post(
  "/",
  authMiddleware,
  [
    body("restaurant_id").isInt({ min: 1 }).withMessage("restaurant_id inválido"),
    body("address").trim().notEmpty().withMessage("Dirección de entrega requerida"),
    body("items").isArray({ min: 1 }).withMessage("items debe ser un array con al menos 1 elemento"),
    body("items.*.dish_id").isInt({ min: 1 }).withMessage("dish_id inválido"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("quantity debe ser >= 1"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { restaurant_id, address, notes, items } = req.body;
      const pool = await getPool();

      // Verificar cada plato en el catalog-service
      let total = 0;
      const enrichedItems = [];
      for (const item of items) {
        const { data: dish } = await axios.get(`${CATALOG_URL}/dishes/${item.dish_id}`).catch(() => {
          const err = new Error(`Plato ${item.dish_id} no encontrado en catálogo`);
          err.status = 404;
          throw err;
        });
        if (!dish.is_available) {
          const err = new Error(`El plato "${dish.name}" no está disponible`);
          err.status = 400;
          throw err;
        }
        total += dish.price * item.quantity;
        enrichedItems.push({ dish_id: dish.id, dish_name: dish.name, price: dish.price, quantity: item.quantity });
      }

      // Insertar orden
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const [orderResult] = await conn.execute(
          "INSERT INTO orders (user_id, restaurant_id, status, total, address, notes) VALUES (?,?,?,?,?,?)",
          [req.user.id, restaurant_id, "pending", total.toFixed(2), address, notes || null]
        );
        const orderId = orderResult.insertId;

        for (const it of enrichedItems) {
          await conn.execute(
            "INSERT INTO order_items (order_id, dish_id, dish_name, price, quantity) VALUES (?,?,?,?,?)",
            [orderId, it.dish_id, it.dish_name, it.price, it.quantity]
          );
        }
        await conn.commit();
        res.status(201).json({ id: orderId, status: "pending", total, items: enrichedItems });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) { next(err); }
  }
);

// ── GET /orders  (del usuario autenticado) ────────────────────────
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [orders] = await pool.execute(
      "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(orders);
  } catch (err) { next(err); }
});

// ── GET /orders/:id ───────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[order]] = await pool.execute("SELECT * FROM orders WHERE id=?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (order.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    const [items] = await pool.execute("SELECT * FROM order_items WHERE order_id=?", [order.id]);
    res.json({ ...order, items });
  } catch (err) { next(err); }
});

// ── PATCH /orders/:id/status ──────────────────────────────────────
router.patch(
  "/:id/status",
  authMiddleware,
  [body("status").notEmpty().withMessage("status requerido")],
  validate,
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const pool = await getPool();
      const [[order]] = await pool.execute("SELECT * FROM orders WHERE id=?", [req.params.id]);
      if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

      const allowed = VALID_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Transición inválida: ${order.status} → ${status}`,
          allowed,
        });
      }

      await pool.execute("UPDATE orders SET status=? WHERE id=?", [status, order.id]);
      res.json({ id: order.id, previous: order.status, current: status });
    } catch (err) { next(err); }
  }
);

module.exports = router;
