const { USER_ROLES } = require("./asset.constants");

const PERMISSIONS = {
  // USER
  CREATE_USER: "CREATE_USER",
  EDIT_USER: "EDIT_USER",
  DELETE_USER: "DELETE_USER",
  RESET_PASSWORD: "RESET_PASSWORD",

  // ASSET
  CREATE_ASSET: "CREATE_ASSET",
  UPDATE_ASSET: "UPDATE_ASSET",
  DELETE_ASSET: "DELETE_ASSET",
  ASSIGN_ASSET: "ASSIGN_ASSET",

  // PRODUCT
  CREATE_PRODUCT: "CREATE_PRODUCT",
  EDIT_PRODUCT: "EDIT_PRODUCT",
  DELETE_PRODUCT: "DELETE_PRODUCT",
};

const MODULE_KEYS = {
  DASHBOARD: "DASHBOARD",
  ASSETS: "ASSETS",
  DEVICE_INFO: "DEVICE_INFO",
  LOGS: "LOGS",
  SETUP: "SETUP",
  USERS: "USERS",
};

const ROLE_DEFAULTS = {
  [USER_ROLES.SUPER_ADMIN]: {
    manageableRoles: [USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE],
    permissions: Object.values(PERMISSIONS),
  },
  [USER_ROLES.ADMIN]: {
    manageableRoles: [USER_ROLES.EMPLOYEE],
    permissions: [
      PERMISSIONS.CREATE_ASSET,
      PERMISSIONS.UPDATE_ASSET,
      PERMISSIONS.DELETE_ASSET,
      PERMISSIONS.ASSIGN_ASSET,
      PERMISSIONS.CREATE_PRODUCT,
      PERMISSIONS.EDIT_PRODUCT,
      PERMISSIONS.DELETE_PRODUCT,
    ],
  },
  [USER_ROLES.EMPLOYEE]: {
    manageableRoles: [],
    permissions: [],
  },
};

function hasAnyPermission(user, needed = []) {
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  return needed.some((perm) => perms.includes(perm));
}

const MODULE_WRITE_PERMISSION_MAP = {
  ASSET: [
    PERMISSIONS.CREATE_ASSET,
    PERMISSIONS.UPDATE_ASSET,
    PERMISSIONS.DELETE_ASSET,
    PERMISSIONS.ASSIGN_ASSET,
  ],
  PRODUCT: [
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
  ],
  USER: [
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.EDIT_USER,
    PERMISSIONS.DELETE_USER,
    PERMISSIONS.RESET_PASSWORD,
  ],
};

function normalizePermissionModule(moduleName) {
  return String(moduleName || "").trim().toUpperCase();
}

function getWritePermissionsForModule(moduleName) {
  return MODULE_WRITE_PERMISSION_MAP[normalizePermissionModule(moduleName)] || [];
}

function hasAnyWritePermission(user, moduleName) {
  return hasAnyPermission(user, getWritePermissionsForModule(moduleName));
}

function canAccessModule(userOrRole, moduleKey) {
  // Backward compatible: previous signature was (role, moduleKey).
  const user = typeof userOrRole === "object" && userOrRole ? userOrRole : null;
  const role = user ? user.role : userOrRole;

  if (!moduleKey) return false;

  // Dashboard/Logs: any authenticated user can access.
  if (moduleKey === MODULE_KEYS.DASHBOARD || moduleKey === MODULE_KEYS.LOGS) {
    return Boolean(role);
  }

  // Prefer permission-driven module access when a user object is available.
  if (user) {
    if (moduleKey === MODULE_KEYS.ASSETS) {
      return hasAnyWritePermission(user, "ASSET");
    }

    if (moduleKey === MODULE_KEYS.DEVICE_INFO) {
      return hasAnyWritePermission(user, "ASSET");
    }

    if (moduleKey === MODULE_KEYS.SETUP) {
      return hasAnyWritePermission(user, "PRODUCT");
    }

    if (moduleKey === MODULE_KEYS.USERS) {
      return hasAnyWritePermission(user, "USER");
    }
  }

  return false;
}

function getRoleDefaults(role) {
  return ROLE_DEFAULTS[role] || { manageableRoles: [], permissions: [] };
}

module.exports = {
  PERMISSIONS,
  MODULE_KEYS,
  hasAnyWritePermission,
  canAccessModule,
  ROLE_DEFAULTS,
  getRoleDefaults,
};
