const router = require("express").Router();
const { body, query } = require("express-validator");
const { getPool } = require("../db");
const { validate } = require("../middleware");

// ── GET /restaurants ──────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { category, open } = req.query;
    const pool = await getPool();
    let sql = "SELECT * FROM restaurants WHERE 1=1";
    const params = [];
    if (category) { sql += " AND category = ?"; params.push(category); }
    if (open !== undefined) { sql += " AND is_open = ?"; params.push(open === "true" ? 1 : 0); }
    sql += " ORDER BY name";
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /restaurants/:id ──────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[restaurant]] = await pool.execute("SELECT * FROM restaurants WHERE id=?", [req.params.id]);
    if (!restaurant) return res.status(404).json({ error: "Restaurante no encontrado" });
    // Incluir platos
    const [dishes] = await pool.execute(
      "SELECT * FROM dishes WHERE restaurant_id=? AND is_available=1 ORDER BY category, name",
      [req.params.id]
    );
    res.json({ ...restaurant, dishes });
  } catch (err) { next(err); }
});

// ── POST /restaurants ─────────────────────────────────────────────
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Nombre requerido"),
    body("address").optional().trim(),
    body("category").optional().trim(),
    body("phone").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, address, phone, category } = req.body;
      const pool = await getPool();
      const [result] = await pool.execute(
        "INSERT INTO restaurants (name, description, address, phone, category) VALUES (?,?,?,?,?)",
        [name, description || null, address || null, phone || null, category || null]
      );
      res.status(201).json({ id: result.insertId, name });
    } catch (err) { next(err); }
  }
);

// ── PUT /restaurants/:id ──────────────────────────────────────────
router.put(
  "/:id",
  [body("name").optional().trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { name, description, address, phone, category, is_open } = req.body;
      const pool = await getPool();
      await pool.execute(
        `UPDATE restaurants SET
          name=COALESCE(?,name), description=COALESCE(?,description),
          address=COALESCE(?,address), phone=COALESCE(?,phone),
          category=COALESCE(?,category), is_open=COALESCE(?,is_open)
         WHERE id=?`,
        [name||null, description||null, address||null, phone||null,
         category||null, is_open??null, req.params.id]
      );
      res.json({ message: "Restaurante actualizado" });
    } catch (err) { next(err); }
  }
);

// ── DELETE /restaurants/:id ───────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    await pool.execute("DELETE FROM restaurants WHERE id=?", [req.params.id]);
    res.json({ message: "Restaurante eliminado" });
  } catch (err) { next(err); }
});

module.exports = router;
