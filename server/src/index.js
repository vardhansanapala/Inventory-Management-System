const { app } = require("./app");
const { connectDb } = require("./config/db");
const env = require("./config/env");
const { ensureDefaultSuperAdmin } = require("./services/bootstrap.service");

async function start() {
  await connectDb();
  await ensureDefaultSuperAdmin();

  app.listen(env.port, () => {
    console.log(`Asset inventory API running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
