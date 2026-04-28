import { ROLES } from "./roles";

export const MODULE_KEYS = {
  DASHBOARD: "dashboard",
  ASSETS: "assets",
  DEVICES: "devices",
  LOGS: "logs",
  SETUP: "setup",
  USERS: "users",
  DEVICE_INFO: "deviceInfo",
};

export const PERMISSIONS = {
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

export const ROLE_DEFAULTS = {
  [ROLES.SUPER_ADMIN]: {
    manageableRoles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permissions: Object.values(PERMISSIONS),
  },
  [ROLES.ADMIN]: {
    manageableRoles: [ROLES.EMPLOYEE],
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
  [ROLES.EMPLOYEE]: {
    manageableRoles: [],
    permissions: [],
  },
};

function hasAnyPermission(user, needed = []) {
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  return needed.some((p) => perms.includes(p));
}

export function canAccessModule(user, moduleKey) {
  if (!user) return false;

  // Dashboard/Logs are allowed for any authenticated user (backend module guard also enforces role access).
  if (moduleKey === MODULE_KEYS.DASHBOARD || moduleKey === MODULE_KEYS.LOGS) {
    return true;
  }

  if (moduleKey === MODULE_KEYS.ASSETS || moduleKey === MODULE_KEYS.DEVICES || moduleKey === MODULE_KEYS.DEVICE_INFO) {
    return hasAnyWritePermission(user, "ASSET");
  }

  if (moduleKey === MODULE_KEYS.SETUP) {
    return hasAnyWritePermission(user, "PRODUCT");
  }

  if (moduleKey === MODULE_KEYS.USERS) {
    return hasAnyWritePermission(user, "USER");
  }

  return false;
}

export function canManageFullSetup(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function hasPermission(user, permission) {
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  return perms.includes(permission);
}

const MODULE_WRITE_PERMISSION_MAP = {
  ASSET: [PERMISSIONS.CREATE_ASSET, PERMISSIONS.UPDATE_ASSET, PERMISSIONS.DELETE_ASSET, PERMISSIONS.ASSIGN_ASSET],
  PRODUCT: [PERMISSIONS.CREATE_PRODUCT, PERMISSIONS.EDIT_PRODUCT, PERMISSIONS.DELETE_PRODUCT],
  USER: [PERMISSIONS.CREATE_USER, PERMISSIONS.EDIT_USER, PERMISSIONS.DELETE_USER, PERMISSIONS.RESET_PASSWORD],
};

export function hasAnyWritePermission(user, moduleName) {
  const key = String(moduleName || "").trim().toUpperCase();
  return hasAnyPermission(user, MODULE_WRITE_PERMISSION_MAP[key] || []);
}

export function getVisibleSidebarLinks(user) {
  const links = [
    { to: "/", label: "Dashboard", moduleKey: MODULE_KEYS.DASHBOARD },
    { to: "/assets", label: "Assets", moduleKey: MODULE_KEYS.ASSETS },
    { to: "/devices", label: "Assigned devices", moduleKey: MODULE_KEYS.DEVICES },
    { to: "/device-info", label: "Device Info", moduleKey: MODULE_KEYS.DEVICE_INFO },
    // { to: "/logs", label: "Logs", moduleKey: MODULE_KEYS.LOGS },
    { to: "/setup", label: "Setup", moduleKey: MODULE_KEYS.SETUP },
    { to: "/users", label: "Users", moduleKey: MODULE_KEYS.USERS },
  ];

  return links.filter((link) => {
    if (link.moduleKey === MODULE_KEYS.DEVICES && user?.role === ROLES.EMPLOYEE) {
      return false;
    }

    return canAccessModule(user, link.moduleKey);
  });
}
