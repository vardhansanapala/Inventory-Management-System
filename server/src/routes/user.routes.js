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
const { MODULE_KEYS, PERMISSIONS } = require("../constants/permissions");
const { requireAuth, requireModuleAccess, requireViewAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/authorize");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.USERS));
router.get("/", requireViewAccess("USER"), asyncHandler(listUsers));
router.post("/", requirePermission(PERMISSIONS.CREATE_USER), asyncHandler(createUser));
router.patch("/:id", requirePermission(PERMISSIONS.EDIT_USER), asyncHandler(updateUser));
router.patch("/:id/reset-password", requirePermission(PERMISSIONS.RESET_PASSWORD), asyncHandler(resetUserPassword));
router.patch("/:id/pause", requirePermission(PERMISSIONS.EDIT_USER), asyncHandler(pauseUser));
router.patch("/:id/resume", requirePermission(PERMISSIONS.EDIT_USER), asyncHandler(resumeUser));
router.delete("/:id", requirePermission(PERMISSIONS.DELETE_USER), asyncHandler(deleteUser));

module.exports = router;
