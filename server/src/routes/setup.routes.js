const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createCategory,
  createLocation,
  createProduct,
  getSetupBootstrap,
} = require("../controllers/setup.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/bootstrap", asyncHandler(getSetupBootstrap));
router.post(
  "/categories",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(createCategory)
);
router.post(
  "/locations",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(createLocation)
);
router.post(
  "/products",
  requireRole(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  asyncHandler(createProduct)
);

module.exports = router;
