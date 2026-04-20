const router = require("express").Router();
const { body } = require("express-validator");
const { validate } = require("../middleware");

// Log en memoria de notificaciones enviadas (en prod usarías una DB o cola)
const sentNotifications = [];

// Plantillas de mensajes según el tipo de evento
const TEMPLATES = {
  order_created:   (data) => `Hola ${data.user_name}, tu pedido #${data.order_id} fue recibido. Total: $${data.total}`,
  order_confirmed: (data) => `Tu pedido #${data.order_id} fue confirmado y está siendo preparado.`,
  order_on_the_way:(data) => `¡Tu pedido #${data.order_id} está en camino! Tiempo estimado: ${data.eta || "30 min"}.`,
  order_delivered: (data) => `Tu pedido #${data.order_id} fue entregado. ¡Buen provecho!`,
  order_cancelled: (data) => `Tu pedido #${data.order_id} fue cancelado.`,
  payment_approved:(data) => `Pago de $${data.amount} aprobado para el pedido #${data.order_id}.`,
  payment_rejected:(data) => `El pago para el pedido #${data.order_id} fue rechazado. Intenta con otro método.`,
};

function simulateSend(channel, recipient, message) {
  const log = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel,
    recipient,
    message,
    sent_at: new Date().toISOString(),
  };
  sentNotifications.push(log);
  console.log(`[notifications] [${channel.toUpperCase()}] → ${recipient}: ${message}`);
  return log;
}

// ── POST /notifications/send ──────────────────────────────────────
router.post(
  "/send",
  [
    body("channel").isIn(["email", "sms", "push"]).withMessage("channel debe ser email, sms o push"),
    body("recipient").notEmpty().withMessage("recipient requerido"),
    body("event").notEmpty().withMessage("event requerido"),
    body("data").isObject().withMessage("data debe ser un objeto"),
  ],
  validate,
  (req, res) => {
    const { channel, recipient, event, data } = req.body;
    const templateFn = TEMPLATES[event];
    const message = templateFn
      ? templateFn(data)
      : data.message || `Notificación: ${event}`;

    const log = simulateSend(channel, recipient, message);
    res.status(200).json({ success: true, notification: log });
  }
);

// ── POST /notifications/broadcast ─────────────────────────────────
router.post(
  "/broadcast",
  [
    body("channels").isArray({ min: 1 }).withMessage("channels debe ser un array"),
    body("recipient").notEmpty(),
    body("event").notEmpty(),
    body("data").isObject(),
  ],
  validate,
  (req, res) => {
    const { channels, recipient, event, data } = req.body;
    const templateFn = TEMPLATES[event];
    const message = templateFn ? templateFn(data) : data.message || `Notificación: ${event}`;
    const logs = channels.map((ch) => simulateSend(ch, recipient, message));
    res.status(200).json({ success: true, sent: logs.length, notifications: logs });
  }
);

// ── GET /notifications/history ────────────────────────────────────
router.get("/history", (req, res) => {
  const { recipient, channel } = req.query;
  let result = [...sentNotifications].reverse();
  if (recipient) result = result.filter((n) => n.recipient === recipient);
  if (channel)   result = result.filter((n) => n.channel === channel);
  res.json({ total: result.length, notifications: result.slice(0, 50) });
});

module.exports = router;
