const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const { getPool } = require("../db");
const { validate } = require("../middleware");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// ── Helpers ──────────────────────────────────────────────────────
function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token requerido" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// ── POST /register ────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Nombre requerido"),
    body("email").isEmail().withMessage("Email inválido"),
    body("password").isLength({ min: 6 }).withMessage("Contraseña mínimo 6 caracteres"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, phone, address } = req.body;
      const pool = await getPool();
      const hash = await bcrypt.hash(password, 10);
      const [result] = await pool.execute(
        "INSERT INTO users (name, email, password, phone, address) VALUES (?,?,?,?,?)",
        [name, email, hash, phone || null, address || null]
      );
      const user = { id: result.insertId, name, email, role: "customer" };
      res.status(201).json({ user, token: makeToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /login ───────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email inválido"),
    body("password").notEmpty().withMessage("Contraseña requerida"),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const pool = await getPool();
      const [[user]] = await pool.execute(
        "SELECT id, name, email, password, role FROM users WHERE email = ?",
        [email]
      );
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }
      delete user.password;
      res.json({ user, token: makeToken(user) });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /me ───────────────────────────────────────────────────────
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[user]] = await pool.execute(
      "SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id  (uso interno entre servicios) ───────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool();
    const [[user]] = await pool.execute(
      "SELECT id, name, email, phone, address, role FROM users WHERE id = ?",
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── PUT /me ───────────────────────────────────────────────────────
router.put(
  "/me",
  authMiddleware,
  [
    body("name").optional().trim().notEmpty(),
    body("phone").optional().isMobilePhone(),
    body("address").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, address } = req.body;
      const pool = await getPool();
      await pool.execute(
        "UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address) WHERE id=?",
        [name || null, phone || null, address || null, req.user.id]
      );
      res.json({ message: "Perfil actualizado" });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /me ────────────────────────────────────────────────────
router.delete("/me", authMiddleware, async (req, res, next) => {
  try {
    const pool = await getPool();
    await pool.execute("DELETE FROM users WHERE id=?", [req.user.id]);
    res.json({ message: "Cuenta eliminada" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
