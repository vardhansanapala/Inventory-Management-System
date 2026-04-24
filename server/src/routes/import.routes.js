const express = require("express");
const multer = require("multer");
const { enqueueAssetCsvImport } = require("../controllers/import.controller");
const { PERMISSIONS } = require("../constants/permissions");
const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);
router.post(
  "/assets",
  requirePermission(PERMISSIONS.CREATE_ASSET),
  upload.single("file"),
  asyncHandler(enqueueAssetCsvImport)
);

module.exports = router;
