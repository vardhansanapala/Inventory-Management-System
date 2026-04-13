const express = require("express");
const {
  createAsset,
  getAssetById,
  getAssetAuditLogs,
  getAssetQrCode,
  listAssets,
  performAssetAction,
  regenerateAssetQrCode,
} = require("../controllers/asset.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/qr/:assetId", asyncHandler(getAssetQrCode));
router.get("/:assetId", asyncHandler(getAssetById));
router.use(requireAuth);
router.get("/", asyncHandler(listAssets));
router.post(
  "/",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(createAsset)
);
router.post(
  "/:assetId/regenerate-qr",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(regenerateAssetQrCode)
);
router.get("/:assetId/audit-logs", asyncHandler(getAssetAuditLogs));
router.post(
  "/:assetId/action",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(performAssetAction)
);

module.exports = router;
