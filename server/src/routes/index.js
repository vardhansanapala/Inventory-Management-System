const express = require("express");
const authRoutes = require("./auth.routes");
const assetRoutes = require("./asset.routes");
const dashboardRoutes = require("./dashboard.routes");
const deviceRoutes = require("./device.routes");
const importRoutes = require("./import.routes");
const logRoutes = require("./log.routes");
const setupRoutes = require("./setup.routes");
const syncRoutes = require("./sync.routes");
const userRoutes = require("./user.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/logs", logRoutes);
router.use("/devices", deviceRoutes);
router.use("/setup", setupRoutes);
router.use("/assets", assetRoutes);
router.use("/imports", importRoutes);
router.use("/sync", syncRoutes);
router.use("/users", userRoutes);

module.exports = router;
