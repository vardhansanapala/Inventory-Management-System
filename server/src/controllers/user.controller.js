const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");
const { User } = require("../models/User");
const { USER_AUDIT_ACTIONS } = require("../models/UserAuditLog");
const { createUserAuditLog } = require("../services/userAudit.service");
const { ApiError } = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { toPublicUser } = require("../utils/userSerializer");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function requireValidPassword(password, fieldName = "Password") {
  if (password.length < 6) {
    throw new ApiError(400, `${fieldName} must be at least 6 characters`);
  }
}

async function ensureEmailAvailable(email, userIdToIgnore = null) {
  const query = { email, isDeleted: false };
  if (userIdToIgnore) {
    query._id = { $ne: userIdToIgnore };
  }

  const existing = await User.findOne(query).select("_id");
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }
}

async function listUsers(_req, res) {
  const users = await User.find({
    status: { $ne: USER_STATUSES.DELETED },
    isDeleted: false,
  }).sort({
    role: 1,
    firstName: 1,
    lastName: 1,
  });

  res.json(users.map(toPublicUser));
}

async function createUser(req, res) {
  const actor = req.user;
  const firstName = normalizeText(req.body.firstName);
  const lastName = normalizeText(req.body.lastName);
  const email = normalizeEmail(req.body.email);
  const employeeCode = normalizeText(req.body.employeeCode) || undefined;
  const role = req.body.role;
  const password = String(req.body.password || "");
  const requestedStatus = normalizeStatus(req.body.status);
  const nextStatus =
    requestedStatus === USER_STATUSES.PAUSED ? USER_STATUSES.PAUSED : USER_STATUSES.ACTIVE;

  if (!firstName || !lastName || !email) {
    throw new ApiError(400, "First name, last name and email are required");
  }

  if (![USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE].includes(role)) {
    throw new ApiError(400, "Invalid role selected");
  }

  if (actor.role !== USER_ROLES.SUPER_ADMIN && role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can create super admin accounts");
  }

  requireValidPassword(password);
  await ensureEmailAvailable(email);

  const user = await User.create({
    firstName,
    lastName,
    email,
    employeeCode,
    role,
    isActive: nextStatus === USER_STATUSES.ACTIVE,
    status: nextStatus,
    passwordHash: await hashPassword(password),
  });

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.USER_CREATED,
    performedBy: actor._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });

  res.status(201).json(toPublicUser(user));
}

async function updateUser(req, res) {
  const actor = req.user;
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: USER_STATUSES.DELETED },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (actor.role !== USER_ROLES.SUPER_ADMIN && user.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can edit super admin accounts");
  }

  if (req.body.firstName !== undefined) {
    const firstName = normalizeText(req.body.firstName);
    if (!firstName) {
      throw new ApiError(400, "First name cannot be empty");
    }
    user.firstName = firstName;
  }

  if (req.body.lastName !== undefined) {
    const lastName = normalizeText(req.body.lastName);
    if (!lastName) {
      throw new ApiError(400, "Last name cannot be empty");
    }
    user.lastName = lastName;
  }

  if (req.body.email !== undefined) {
    throw new ApiError(400, "Email cannot be updated");
  }

  user.employeeCode =
    req.body.employeeCode !== undefined ? normalizeText(req.body.employeeCode) || undefined : user.employeeCode;

  if (req.body.role !== undefined) {
    if (![USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.EMPLOYEE].includes(req.body.role)) {
      throw new ApiError(400, "Invalid role selected");
    }
    if (actor.role !== USER_ROLES.SUPER_ADMIN && req.body.role === USER_ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Only super admins can assign super admin role");
    }
    user.role = req.body.role;
  }

  if (req.body.status !== undefined) {
    const nextStatus = normalizeStatus(req.body.status);
    if (![USER_STATUSES.ACTIVE, USER_STATUSES.PAUSED].includes(nextStatus)) {
      throw new ApiError(400, "Invalid status selected");
    }
    if (String(actor._id) === String(user._id) && nextStatus === USER_STATUSES.PAUSED) {
      throw new ApiError(400, "You cannot pause your own account");
    }
    user.status = nextStatus;
    user.isActive = nextStatus === USER_STATUSES.ACTIVE;
  }

  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.USER_UPDATED,
    performedBy: actor._id,
    targetUserId: user._id,
    metadata: {
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  res.json(toPublicUser(user));
}

async function resetUserPassword(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: USER_STATUSES.DELETED },
  }).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const newPassword = String(req.body.password || req.body.newPassword || "");
  requireValidPassword(newPassword, "New password");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.PASSWORD_RESET,
    performedBy: req.user._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
    },
  });

  res.json({
    message: "Password updated successfully",
  });
}

async function pauseUser(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: USER_STATUSES.DELETED },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (String(req.user._id) === String(user._id)) {
    throw new ApiError(400, "You cannot pause your own account");
  }

  user.status = USER_STATUSES.PAUSED;
  user.isActive = false;
  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.ACCOUNT_PAUSED,
    performedBy: req.user._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
    },
  });

  res.json({
    message: "User account paused",
  });
}

async function resumeUser(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: USER_STATUSES.DELETED },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.status = USER_STATUSES.ACTIVE;
  user.isActive = true;
  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.ACCOUNT_RESUMED,
    performedBy: req.user._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
    },
  });

  res.json({
    message: "User account resumed",
  });
}

async function deleteUser(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    status: { $ne: USER_STATUSES.DELETED },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (String(req.user._id) === String(user._id)) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  user.status = USER_STATUSES.DELETED;
  user.isDeleted = true;
  user.isActive = false;
  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.USER_DELETED,
    performedBy: req.user._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
      role: user.role,
    },
  });

  res.json({
    message: "User deleted successfully",
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  pauseUser,
  resumeUser,
  deleteUser,
};
