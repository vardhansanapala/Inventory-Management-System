const express = require("express");
const { getDeviceByIdPublic } = require("../controllers/asset.controller");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.get("/:assetId", asyncHandler(getDeviceByIdPublic));

module.exports = router;
