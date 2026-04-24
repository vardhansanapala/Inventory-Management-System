const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createCategory,
  createLocation,
  createProduct,
  getSetupBootstrap,
  updateCategory,
  updateLocation,
  deleteCategory,
  deleteLocation,
  updateProduct,
  deleteProduct,
} = require("../controllers/setup.controller");
const { USER_ROLES } = require("../constants/asset.constants");
const { MODULE_KEYS, PERMISSIONS } = require("../constants/permissions");
const { requireAuth, requireModuleAccess, requireRole, requireViewAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/authorize");

const router = express.Router();

router.use(requireAuth, requireModuleAccess(MODULE_KEYS.SETUP));
router.get("/bootstrap", requireViewAccess("PRODUCT"), asyncHandler(getSetupBootstrap));
router.post(
  "/categories",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(createCategory)
);
router.patch(
  "/categories/:id",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(updateCategory)
);
router.delete(
  "/categories/:id",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(deleteCategory)
);
router.post(
  "/locations",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(createLocation)
);
router.patch(
  "/locations/:id",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(updateLocation)
);
router.delete(
  "/locations/:id",
  requireRole(USER_ROLES.SUPER_ADMIN),
  asyncHandler(deleteLocation)
);
router.post(
  "/products",
  requirePermission(PERMISSIONS.CREATE_PRODUCT),
  asyncHandler(createProduct)
);
router.patch(
  "/products/:id",
  requirePermission(PERMISSIONS.EDIT_PRODUCT),
  asyncHandler(updateProduct)
);
router.delete(
  "/products/:id",
  requirePermission(PERMISSIONS.DELETE_PRODUCT),
  asyncHandler(deleteProduct)
);

module.exports = router;
