const express = require("express");
const { syncOfflineActions } = require("../controllers/sync.controller");
const { PERMISSIONS } = require("../constants/permissions");
const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth);
router.post(
  "/offline-actions",
  requirePermission(PERMISSIONS.UPDATE_ASSET),
  asyncHandler(syncOfflineActions)
);

module.exports = router;
