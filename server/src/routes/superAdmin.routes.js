const express = require("express");
const { USER_ROLES } = require("../constants/asset.constants");
const { updatePassword, updateProfile } = require("../controllers/superAdmin.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.patch("/profile", requireAuth, requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(updateProfile));
router.patch("/password", requireAuth, requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(updatePassword));

module.exports = router;
