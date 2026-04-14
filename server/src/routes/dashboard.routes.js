const express = require("express");
const { MODULE_KEYS } = require("../constants/permissions");
const { getDashboardSummary } = require("../controllers/dashboard.controller");
const { requireAuth, requireModuleAccess } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.DASHBOARD));
router.get("/summary", asyncHandler(getDashboardSummary));

module.exports = router;
