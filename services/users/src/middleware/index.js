const { validationResult } = require("express-validator");

// Valida resultados de express-validator
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Manejador global de errores
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.path} →`, err.message);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "El recurso ya existe" });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Error interno del servidor" });
}

module.exports = { validate, errorHandler };
