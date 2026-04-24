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
  VIEW_ASSET: "VIEW_ASSET",

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
      PERMISSIONS.VIEW_ASSET,
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
    permissions: [PERMISSIONS.VIEW_ASSET],
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

  if (moduleKey === MODULE_KEYS.ASSETS || moduleKey === MODULE_KEYS.DEVICES) {
    return hasAnyPermission(user, [PERMISSIONS.VIEW_ASSET, PERMISSIONS.CREATE_ASSET, PERMISSIONS.UPDATE_ASSET, PERMISSIONS.ASSIGN_ASSET]);
  }

  if (moduleKey === MODULE_KEYS.SETUP) {
    return hasAnyPermission(user, [PERMISSIONS.CREATE_PRODUCT, PERMISSIONS.EDIT_PRODUCT, PERMISSIONS.DELETE_PRODUCT]);
  }

  if (moduleKey === MODULE_KEYS.USERS) {
    return hasAnyPermission(user, [PERMISSIONS.CREATE_USER, PERMISSIONS.EDIT_USER, PERMISSIONS.DELETE_USER, PERMISSIONS.RESET_PASSWORD]);
  }

  if (moduleKey === MODULE_KEYS.DEVICE_INFO) {
    return true;
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
    return canAccessModule(user, link.moduleKey);
  });
}
