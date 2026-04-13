const env = require("../config/env");
const { USER_ROLES } = require("../constants/asset.constants");
const { User } = require("../models/User");
const { comparePassword, hashPassword } = require("../utils/password");

async function ensureDefaultSuperAdmin() {
  const email = env.defaultSuperAdminEmail.toLowerCase().trim();

  let user = await User.findOne({ email }).select("+passwordHash");

  if (!user) {
    const passwordHash = await hashPassword(env.defaultSuperAdminPassword);
    user = await User.create({
      firstName: "System",
      lastName: "Super Admin",
      email,
      employeeCode: "SYS-ADMIN",
      role: USER_ROLES.SUPER_ADMIN,
      passwordHash,
      isActive: true,
    });

    console.log(`Default super admin created for ${email}`);
    return user;
  }

  let requiresSave = false;

  if (user.role !== USER_ROLES.SUPER_ADMIN) {
    user.role = USER_ROLES.SUPER_ADMIN;
    requiresSave = true;
  }

  if (!user.passwordHash) {
    user.passwordHash = await hashPassword(env.defaultSuperAdminPassword);
    requiresSave = true;
  }

  if (env.resetSuperAdminPasswordOnBoot) {
    const passwordMatchesDefault = await comparePassword(
      env.defaultSuperAdminPassword,
      user.passwordHash
    );
    if (!passwordMatchesDefault) {
      user.passwordHash = await hashPassword(env.defaultSuperAdminPassword);
      requiresSave = true;
    }
  }

  if (!user.isActive) {
    user.isActive = true;
    requiresSave = true;
  }

  if (requiresSave) {
    await user.save();
    console.log(`Default super admin credentials refreshed for ${email}`);
  }

  return user;
}

module.exports = {
  ensureDefaultSuperAdmin,
};

