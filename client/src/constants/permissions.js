import { ROLES } from "./roles";

export const MODULE_KEYS = {
  DASHBOARD: "dashboard",
  ASSETS: "assets",
  LOGS: "logs",
  SETUP: "setup",
  USERS: "users",
};

const MODULE_ACCESS = {
  [MODULE_KEYS.DASHBOARD]: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EMPLOYEE],
  [MODULE_KEYS.ASSETS]: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  [MODULE_KEYS.LOGS]: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EMPLOYEE],
  [MODULE_KEYS.SETUP]: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  [MODULE_KEYS.USERS]: [ROLES.SUPER_ADMIN],
};

export function canAccessModule(user, moduleKey) {
  const role = user?.role;
  return Boolean(role && MODULE_ACCESS[moduleKey]?.includes(role));
}

export function canManageFullSetup(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function getVisibleSidebarLinks(user) {
  const links = [
    { to: "/", label: "Dashboard", moduleKey: MODULE_KEYS.DASHBOARD },
    { to: "/assets", label: "Assets", moduleKey: MODULE_KEYS.ASSETS },
    { to: "/logs", label: "Logs", moduleKey: MODULE_KEYS.LOGS },
    { to: "/setup", label: "Setup", moduleKey: MODULE_KEYS.SETUP },
    { to: "/users", label: "Users", moduleKey: MODULE_KEYS.USERS },
  ];

  return links.filter((link) => canAccessModule(user, link.moduleKey));
}
