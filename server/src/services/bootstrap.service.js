const env = require("../config/env");
const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");
const { getRoleDefaults } = require("../constants/permissions");
const { User } = require("../models/User");
const { hashPassword } = require("../utils/password");
const { assertStrongPassword } = require("../utils/passwordPolicy");

async function ensureDefaultSuperAdmin() {
  if (!env.enableBootstrap) {
    console.log("Bootstrap disabled. Skipping super admin initialization.");
    return null;
  }

  const existingSuperAdmin = await User.findOne({
    role: USER_ROLES.SUPER_ADMIN,
  });

  if (existingSuperAdmin) {
    console.log("Super admin already exists. Skipping bootstrap initialization.");
    return existingSuperAdmin;
  }

  const email = env.defaultSuperAdminEmail.toLowerCase().trim();
  const firstName = env.defaultSuperAdminFirstName.trim();
  const lastName = env.defaultSuperAdminLastName.trim();
  const employeeCode = env.defaultSuperAdminEmployeeCode.trim();

  if (!email || !env.defaultSuperAdminPassword || !firstName || !lastName || !employeeCode) {
    throw new Error(
      "Bootstrap is enabled but DEFAULT_SUPER_ADMIN_EMAIL, DEFAULT_SUPER_ADMIN_PASSWORD, DEFAULT_SUPER_ADMIN_FIRST_NAME, DEFAULT_SUPER_ADMIN_LAST_NAME, and DEFAULT_SUPER_ADMIN_EMPLOYEE_CODE are required."
    );
  }

  assertStrongPassword(env.defaultSuperAdminPassword);

  const existingEmailUser = await User.findOne({ email, isDeleted: false });
  if (existingEmailUser) {
    throw new Error(
      `Bootstrap cannot create a super admin because ${email} is already assigned to a non-super-admin user.`
    );
  }

  const defaults = getRoleDefaults(USER_ROLES.SUPER_ADMIN);
  const passwordHash = await hashPassword(env.defaultSuperAdminPassword);
  const user = await User.create({
    firstName,
    lastName,
    email,
    employeeCode,
    role: USER_ROLES.SUPER_ADMIN,
    permissions: defaults.permissions,
    manageableRoles: defaults.manageableRoles,
    passwordHash,
    isActive: true,
    status: USER_STATUSES.ACTIVE,
  });

  console.log(`Default super admin created for ${email}`);
  return user;
}

module.exports = {
  ensureDefaultSuperAdmin,
};

