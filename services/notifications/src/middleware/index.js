const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.path} →`, err.message);
  res.status(err.status || 500).json({ error: err.message || "Error interno" });
}

module.exports = { validate, errorHandler };
