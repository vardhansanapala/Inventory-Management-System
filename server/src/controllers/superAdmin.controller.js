const { USER_ROLES } = require("../constants/asset.constants");
const { User } = require("../models/User");
const { ApiError } = require("../utils/ApiError");
const { comparePassword, hashPassword } = require("../utils/password");
const { assertStrongPassword } = require("../utils/passwordPolicy");
const { toPublicUser } = require("../utils/userSerializer");

function getRequiredString(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldName} is required`);
  }
  return normalized;
}

async function getAuthenticatedSuperAdminWithPassword(req) {
  if (!req.user || req.user.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only Super Admins can perform this action");
  }

  const user = await User.findOne({
    _id: req.user._id,
    role: USER_ROLES.SUPER_ADMIN,
    isDeleted: false,
    isActive: true,
  }).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid or expired session");
  }

  return user;
}

async function verifyCurrentPassword(user, currentPassword) {
  const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new ApiError(401, "Current password is incorrect");
  }
}

async function updateProfile(req, res) {
  const user = await getAuthenticatedSuperAdminWithPassword(req);
  const currentPassword = getRequiredString(req.body.currentPassword, "Current password");
  const email = getRequiredString(req.body.email, "Email").toLowerCase();
  const firstName = getRequiredString(req.body.firstName, "First name");
  const lastName = getRequiredString(req.body.lastName, "Last name");

  await verifyCurrentPassword(user, currentPassword);

  const existingEmailUser = await User.findOne({
    _id: { $ne: user._id },
    email,
    isDeleted: false,
  });

  if (existingEmailUser) {
    throw new ApiError(409, "Email is already in use");
  }

  user.email = email;
  user.firstName = firstName;
  user.lastName = lastName;
  await user.save();

  res.json({
    user: toPublicUser(user),
  });
}

async function updatePassword(req, res) {
  const user = await getAuthenticatedSuperAdminWithPassword(req);
  const currentPassword = getRequiredString(req.body.currentPassword, "Current password");
  const newPassword = getRequiredString(req.body.newPassword, "New password");
  const confirmPassword = getRequiredString(req.body.confirmPassword, "Confirm password");

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New password and confirm password must match");
  }

  await verifyCurrentPassword(user, currentPassword);
  assertStrongPassword(newPassword, { currentPassword });

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  res.json({
    message: "Password updated successfully",
  });
}

module.exports = {
  updateProfile,
  updatePassword,
};
