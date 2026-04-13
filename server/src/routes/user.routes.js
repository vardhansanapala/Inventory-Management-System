const express = require("express");
const { createUser, listUsers, resetUserPassword, updateUser } = require("../controllers/user.controller");
const { requireRole } = require("../middleware/auth");
const { USER_ROLES } = require("../constants/asset.constants");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.use(requireRole(USER_ROLES.SUPER_ADMIN));
router.get("/", asyncHandler(listUsers));
router.post("/", asyncHandler(createUser));
router.patch("/:id", asyncHandler(updateUser));
router.post("/:id/reset-password", asyncHandler(resetUserPassword));

module.exports = router;
