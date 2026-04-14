const express = require("express");
const {
  getAssetBootstrap,
  createAsset,
  getAssetById,
  getAssetDetails,
  getAssetAuditLogs,
  getAssetQrCode,
  listAssets,
  performAssetAction,
  regenerateAssetQrCode,
  updateAsset,
  deleteAsset,
} = require("../controllers/asset.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { MODULE_KEYS, PERMISSIONS } = require("../constants/permissions");
const { requireAuth, requireModuleAccess, requireRole, hasPermission } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/qr/:assetId", asyncHandler(getAssetQrCode));
router.use(requireAuth, requireModuleAccess(MODULE_KEYS.ASSETS));
router.get("/bootstrap", asyncHandler(getAssetBootstrap));
router.get("/", asyncHandler(listAssets));
router.get("/:assetId/details", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(getAssetDetails));
router.get("/:assetId", asyncHandler(getAssetById));
router.patch("/:assetId", hasPermission(PERMISSIONS.UPDATE_ASSET), asyncHandler(updateAsset));
router.delete("/:assetId", hasPermission(PERMISSIONS.DELETE_ASSET), asyncHandler(deleteAsset));
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
