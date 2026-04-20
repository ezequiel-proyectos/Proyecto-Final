const express = require("express");
const { register, httpMetrics } = require("./metrics");
const { errorHandler } = require("./middleware");
const restaurantsRouter = require("./routes/restaurants");
const dishesRouter = require("./routes/dishes");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(httpMetrics);

app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "catalog" }));

app.use("/restaurants", restaurantsRouter);
app.use("/dishes", dishesRouter);

app.use(errorHandler);

app.listen(PORT, () => console.log(`[catalog-service] corriendo en puerto ${PORT}`));
