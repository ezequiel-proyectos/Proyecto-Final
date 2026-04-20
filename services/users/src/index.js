const express = require("express");
const { register, httpMetrics } = require("./metrics");
const { errorHandler } = require("./middleware");
const usersRouter = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(httpMetrics);

// Health check
app.get("/metrics", async (_, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "users" }));

// Rutas
app.use("/users", usersRouter);

// Manejador de errores (siempre al final)
app.use(errorHandler);

app.listen(PORT, () => console.log(`[users-service] corriendo en puerto ${PORT}`));
