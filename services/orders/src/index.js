const express = require("express");
const { register, httpMetrics } = require("./metrics");
const { errorHandler } = require("./middleware");
const ordersRouter = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use(httpMetrics);

app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "orders" }));

app.use("/orders", ordersRouter);

app.use(errorHandler);

app.listen(PORT, () => console.log(`[orders-service] corriendo en puerto ${PORT}`));
