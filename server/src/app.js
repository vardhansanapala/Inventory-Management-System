const cors = require("cors");
const express = require("express");
const env = require("./config/env");
const { attachUserFromToken } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");
const { notFound } = require("./middleware/notFound");
const apiRoutes = require("./routes");

const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(attachUserFromToken);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = {
  app,
};
