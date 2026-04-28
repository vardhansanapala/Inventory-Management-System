const express = require("express");
const { getAssetById } = require("../controllers/asset.controller");
const { requireAuth, requireAnyWriteAccess } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/:assetId", requireAuth, requireAnyWriteAccess("ASSET"), asyncHandler(getAssetById));

module.exports = router;
