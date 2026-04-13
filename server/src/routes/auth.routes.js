const express = require("express");
const { getCurrentUser, login } = require("../controllers/auth.controller");
const { attachUserFromToken, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.get("/me", attachUserFromToken, requireAuth, asyncHandler(getCurrentUser));

module.exports = router;

