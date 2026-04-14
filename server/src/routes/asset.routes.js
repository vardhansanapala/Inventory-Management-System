const express = require("express");
const {
  getAssetBootstrap,
  createAsset,
  getAssetById,
  getAssetAuditLogs,
  getAssetQrCode,
  listAssets,
  performAssetAction,
  regenerateAssetQrCode,
} = require("../controllers/asset.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { MODULE_KEYS } = require("../constants/permissions");
const { requireAuth, requireModuleAccess, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/qr/:assetId", asyncHandler(getAssetQrCode));
router.use(requireAuth, requireModuleAccess(MODULE_KEYS.ASSETS));
router.get("/bootstrap", asyncHandler(getAssetBootstrap));
router.get("/", asyncHandler(listAssets));
router.get("/:assetId", asyncHandler(getAssetById));
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
