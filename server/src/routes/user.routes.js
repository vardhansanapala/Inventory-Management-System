const express = require("express");
const {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  pauseUser,
  resumeUser,
  deleteUser,
} = require("../controllers/user.controller");
const { MODULE_KEYS } = require("../constants/permissions");
const { requireAuth, requireModuleAccess, requireRole } = require("../middleware/auth");
const { USER_ROLES } = require("../constants/asset.constants");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.USERS));
router.get("/", asyncHandler(listUsers));
router.post("/", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(createUser));
router.patch("/:id", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(updateUser));
router.patch("/:id/reset-password", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(resetUserPassword));
router.patch("/:id/pause", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(pauseUser));
router.patch("/:id/resume", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(resumeUser));
router.delete("/:id", requireRole(USER_ROLES.SUPER_ADMIN), asyncHandler(deleteUser));

module.exports = router;
