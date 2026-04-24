/**
 * Permission-based authorization for routes.
 * Delegates to the shared guard in auth middleware (single implementation).
 */
const { hasPermission, requireViewAccess } = require("./auth");

/** @param {string} permission - value from PERMISSIONS */
function requirePermission(permission) {
  return hasPermission(permission);
}

module.exports = {
  requirePermission,
  requireViewAccess,
};
