const express = require("express");
const { getDashboardSummary } = require("../controllers/dashboard.controller");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth);
router.get("/summary", asyncHandler(getDashboardSummary));

module.exports = router;
