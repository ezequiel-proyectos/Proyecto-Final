const express = require("express");
const { register, httpMetrics } = require("./metrics");
const { errorHandler } = require("./middleware");
const notificationsRouter = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(httpMetrics);

app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "notifications" }));

app.use("/notifications", notificationsRouter);

app.use(errorHandler);

app.listen(PORT, () => console.log(`[notifications-service] corriendo en puerto ${PORT}`));
