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
const { requireAuth, requireModuleAccess, hasPermission } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.USERS));
router.get("/", asyncHandler(listUsers));
router.post("/", hasPermission(PERMISSIONS.CREATE_USER), asyncHandler(createUser));
router.patch("/:id", hasPermission(PERMISSIONS.EDIT_USER), asyncHandler(updateUser));
router.patch("/:id/reset-password", hasPermission(PERMISSIONS.RESET_PASSWORD), asyncHandler(resetUserPassword));
router.patch("/:id/pause", hasPermission(PERMISSIONS.EDIT_USER), asyncHandler(pauseUser));
router.patch("/:id/resume", hasPermission(PERMISSIONS.EDIT_USER), asyncHandler(resumeUser));
router.delete("/:id", hasPermission(PERMISSIONS.DELETE_USER), asyncHandler(deleteUser));

module.exports = router;
