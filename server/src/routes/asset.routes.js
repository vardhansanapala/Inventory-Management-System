const express = require("express");
const {
  createAsset,
  getAssetById,
  getAssetAuditLogs,
  getAssetQrCode,
  listAssets,
  performAssetAction,
} = require("../controllers/asset.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth);
router.get("/", asyncHandler(listAssets));
router.get("/qr/:assetCode", asyncHandler(getAssetQrCode));
router.post(
  "/",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(createAsset)
);
router.get("/:id", asyncHandler(getAssetById));
router.get("/:id/audit-logs", asyncHandler(getAssetAuditLogs));
router.post(
  "/:id/action",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(performAssetAction)
);

module.exports = router;
