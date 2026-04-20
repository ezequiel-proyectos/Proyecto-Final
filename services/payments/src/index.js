const express = require("express");
const { register, httpMetrics } = require("./metrics");
const { errorHandler } = require("./middleware");
const paymentsRouter = require("./routes/payments");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.use(httpMetrics);

app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "payments" }));

app.use("/payments", paymentsRouter);

app.use(errorHandler);

app.listen(PORT, () => console.log(`[payments-service] corriendo en puerto ${PORT}`));
