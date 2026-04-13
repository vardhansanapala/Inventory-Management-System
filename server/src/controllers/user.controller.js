const { USER_ROLES } = require("../constants/asset.constants");
const { User } = require("../models/User");
const { ApiError } = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { toPublicUser } = require("../utils/userSerializer");

async function listUsers(_req, res) {
  const users = await User.find({ isDeleted: false }).sort({
    role: 1,
    firstName: 1,
    lastName: 1,
  });

  res.json(users.map(toPublicUser));
}

async function createUser(req, res) {
  const password = String(req.body.password || "");

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const user = await User.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    employeeCode: req.body.employeeCode || null,
    role: req.body.role,
    isActive: req.body.isActive !== "false" && req.body.isActive !== false,
    passwordHash: await hashPassword(password),
  });

  res.status(201).json(toPublicUser(user));
}

async function updateUser(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.firstName = req.body.firstName ?? user.firstName;
  user.lastName = req.body.lastName ?? user.lastName;
  user.email = req.body.email ?? user.email;
  user.employeeCode =
    req.body.employeeCode !== undefined ? req.body.employeeCode || null : user.employeeCode;
  user.role = req.body.role ?? user.role;
  user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

  await user.save();

  res.json(toPublicUser(user));
}

async function resetUserPassword(req, res) {
  const actor = req.user;
  const user = await User.findOne({
    _id: req.params.id,
    isDeleted: false,
  }).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only a super admin can change user passwords");
  }

  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Super admin passwords cannot be changed from this screen");
  }

  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters");
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  res.json({
    message: `Password updated for ${user.firstName} ${user.lastName}`,
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
};

