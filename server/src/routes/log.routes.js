const express = require("express");
const { listLogs } = require("../controllers/log.controller");
const { requireAuth, requireModuleAccess } = require("../middleware/auth");
const { MODULE_KEYS } = require("../constants/permissions");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.LOGS));
router.get("/", asyncHandler(listLogs));

module.exports = router;
