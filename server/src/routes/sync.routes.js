const express = require("express");
const { syncOfflineActions } = require("../controllers/sync.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth);
router.post(
  "/offline-actions",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(syncOfflineActions)
);

module.exports = router;
