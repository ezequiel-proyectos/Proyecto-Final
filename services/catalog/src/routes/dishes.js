const router = require("express").Router();
const { body } = require("express-validator");
const { getPool } = require("../db");
const { validate } = require("../middleware");

// ── GET /dishes  (con filtros opcionales) ─────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { restaurant_id, category } = req.query;
    const pool = await getPool();
    let sql = "SELECT * FROM dishes WHERE is_available=1";
    const params = [];
    if (restaurant_id) { sql += " AND restaurant_id=?"; params.push(restaurant_id); }
    if (category)      { sql += " AND category=?";      params.push(category); }
    sql += " ORDER BY restaurant_id, category, name";
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /dishes/:id ───────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[dish]] = await pool.execute("SELECT * FROM dishes WHERE id=?", [req.params.id]);
    if (!dish) return res.status(404).json({ error: "Plato no encontrado" });
    res.json(dish);
  } catch (err) { next(err); }
});

// ── POST /dishes ──────────────────────────────────────────────────
router.post(
  "/",
  [
    body("restaurant_id").isInt({ min: 1 }).withMessage("restaurant_id inválido"),
    body("name").trim().notEmpty().withMessage("Nombre requerido"),
    body("price").isFloat({ min: 0 }).withMessage("Precio inválido"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { restaurant_id, name, description, price, category } = req.body;
      const pool = await getPool();

      // Verificar que el restaurante existe
      const [[rest]] = await pool.execute("SELECT id FROM restaurants WHERE id=?", [restaurant_id]);
      if (!rest) return res.status(404).json({ error: "Restaurante no encontrado" });

      const [result] = await pool.execute(
        "INSERT INTO dishes (restaurant_id, name, description, price, category) VALUES (?,?,?,?,?)",
        [restaurant_id, name, description || null, price, category || null]
      );
      res.status(201).json({ id: result.insertId, restaurant_id, name, price });
    } catch (err) { next(err); }
  }
);

// ── PUT /dishes/:id ───────────────────────────────────────────────
router.put(
  "/:id",
  [body("price").optional().isFloat({ min: 0 })],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, price, category, is_available } = req.body;
      const pool = await getPool();
      await pool.execute(
        `UPDATE dishes SET
          name=COALESCE(?,name), description=COALESCE(?,description),
          price=COALESCE(?,price), category=COALESCE(?,category),
          is_available=COALESCE(?,is_available)
         WHERE id=?`,
        [name||null, description||null, price??null, category||null, is_available??null, req.params.id]
      );
      res.json({ message: "Plato actualizado" });
    } catch (err) { next(err); }
  }
);

// ── DELETE /dishes/:id ────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    await pool.execute("DELETE FROM dishes WHERE id=?", [req.params.id]);
    res.json({ message: "Plato eliminado" });
  } catch (err) { next(err); }
});

module.exports = router;
