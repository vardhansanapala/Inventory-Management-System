const express = require("express");
const multer = require("multer");
const { enqueueAssetCsvImport } = require("../controllers/import.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);
router.post(
  "/assets",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  upload.single("file"),
  asyncHandler(enqueueAssetCsvImport)
);

module.exports = router;
