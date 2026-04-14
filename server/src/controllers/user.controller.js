const { USER_ROLES, USER_STATUSES } = require("../constants/asset.constants");
const { User } = require("../models/User");
const { USER_AUDIT_ACTIONS } = require("../models/UserAuditLog");
const { createUserAuditLog } = require("../services/userAudit.service");
const { PERMISSIONS, getRoleDefaults } = require("../constants/permissions");
const { ApiError } = require("../utils/ApiError");
const { hashPassword } = require("../utils/password");
const { toPublicUser } = require("../utils/userSerializer");
const { RBAC_AUDIT_TARGET_TYPES, RbacAuditLog } = require("../models/RbacAuditLog");

const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS));

function normalizeRequestedPermissions(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, "permissions must be an array");
  }

  const cleaned = value
    .map((p) => String(p || "").trim())
    .filter(Boolean);

  const unique = Array.from(new Set(cleaned));
  const invalid = unique.filter((p) => !VALID_PERMISSIONS.has(p));
  if (invalid.length) {
    throw new ApiError(400, `Invalid permissions: ${invalid.join(", ")}`);
  }

  return unique;
}

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

  if (role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "You cannot create a SUPER_ADMIN user");
  }

  const actorPermissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!actorPermissions.includes(PERMISSIONS.CREATE_USER)) {
    throw new ApiError(403, "Missing permission: CREATE_USER");
  }

  const actorManageableRoles = Array.isArray(actor.manageableRoles) ? actor.manageableRoles : [];
  if (!actorManageableRoles.includes(role)) {
    throw new ApiError(403, "You are not allowed to create users with this role");
  }

  requireValidPassword(password);
  await ensureEmailAvailable(email);

  const defaults = getRoleDefaults(role);
  const requestedPermissions = normalizeRequestedPermissions(req.body.permissions);
  if (requestedPermissions !== undefined && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only super admins can set custom permissions");
  }
  const permissions =
    !requestedPermissions || requestedPermissions.length === 0 ? defaults.permissions : requestedPermissions;

  const requestedManageableRoles = Array.isArray(req.body.manageableRoles) ? req.body.manageableRoles : [];
  const manageableRoles =
    role === USER_ROLES.ADMIN && actor.role === USER_ROLES.SUPER_ADMIN
      ? requestedManageableRoles.filter((r) => r !== USER_ROLES.SUPER_ADMIN)
      : defaults.manageableRoles;

  const user = await User.create({
    firstName,
    lastName,
    email,
    employeeCode,
    role,
    permissions,
    manageableRoles,
    createdBy: actor._id,
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

  await RbacAuditLog.create({
    action: "USER_CREATED",
    performedBy: actor._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
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

  const actorPermissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!actorPermissions.includes(PERMISSIONS.EDIT_USER)) {
    throw new ApiError(403, "Missing permission: EDIT_USER");
  }

  const actorManageableRoles = Array.isArray(actor.manageableRoles) ? actor.manageableRoles : [];

  const isSelf = String(actor._id) === String(user._id);
  if (isSelf) {
    if (req.body.role !== undefined) {
      throw new ApiError(400, "You cannot change your own role");
    }
    if (req.body.permissions !== undefined) {
      throw new ApiError(400, "You cannot modify your own permissions");
    }
  }

  if (user.role === USER_ROLES.SUPER_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "You cannot update a super admin user");
  }

  if (actor.role !== USER_ROLES.SUPER_ADMIN && !actorManageableRoles.includes(user.role)) {
    throw new ApiError(403, "You are not allowed to update users with this role");
  }

  const permissionsBefore = Array.isArray(user.permissions) ? user.permissions.slice() : [];
  const roleBefore = user.role;
  const statusBefore = user.status;

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

    if (req.body.role === USER_ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "You cannot assign the SUPER_ADMIN role");
    }

    if (!actorManageableRoles.includes(req.body.role)) {
      throw new ApiError(403, "You are not allowed to assign this role");
    }
    user.role = req.body.role;
  }

  // If role was changed, ensure the new role is also manageable.
  if (req.body.role !== undefined && actor.role !== USER_ROLES.SUPER_ADMIN && !actorManageableRoles.includes(user.role)) {
    throw new ApiError(403, "You are not allowed to assign this role");
  }

  if (req.body.manageableRoles !== undefined) {
    if (actor.role !== USER_ROLES.SUPER_ADMIN || user.role !== USER_ROLES.ADMIN) {
      throw new ApiError(403, "Only super admins can update manageable roles for admins");
    }
    if (isSelf) {
      throw new ApiError(400, "You cannot modify your own manageable roles");
    }
    const requested = Array.isArray(req.body.manageableRoles) ? req.body.manageableRoles : [];
    user.manageableRoles = requested.filter((r) => r !== USER_ROLES.SUPER_ADMIN);
  }

  if (req.body.permissions !== undefined) {
    if (actor.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Only super admins can modify user permissions");
    }

    const requestedPermissions = normalizeRequestedPermissions(req.body.permissions) || [];
    const defaults = getRoleDefaults(user.role);
    user.permissions = requestedPermissions.length ? requestedPermissions : defaults.permissions;
  } else if (req.body.role !== undefined) {
    // If role changes and permissions weren't explicitly provided, reset to role defaults.
    const defaults = getRoleDefaults(user.role);
    user.permissions = defaults.permissions;
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

  await RbacAuditLog.create({
    action: "USER_UPDATED",
    performedBy: actor._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
    metadata: {
      roleBefore,
      roleAfter: user.role,
      statusBefore,
      statusAfter: user.status,
      permissionsBefore,
      permissionsAfter: Array.isArray(user.permissions) ? user.permissions : [],
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

  const actor = req.user;
  const actorPermissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  if (!actorPermissions.includes(PERMISSIONS.RESET_PASSWORD)) {
    throw new ApiError(403, "Missing permission: RESET_PASSWORD");
  }

  if (user.role === USER_ROLES.SUPER_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "You cannot reset a super admin password");
  }

  const actorManageableRoles = Array.isArray(actor.manageableRoles) ? actor.manageableRoles : [];
  if (!actorManageableRoles.includes(user.role)) {
    throw new ApiError(403, "You are not allowed to reset passwords for this role");
  }

  const isOwner = String(user.createdBy || "") === String(actor._id);
  if (actor.role !== USER_ROLES.SUPER_ADMIN && !isOwner) {
    throw new ApiError(403, "You can only reset passwords for users you created");
  }

  const newPassword = String(req.body.password || req.body.newPassword || "");
  requireValidPassword(newPassword, "New password");

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await createUserAuditLog({
    actionType: USER_AUDIT_ACTIONS.PASSWORD_RESET,
    performedBy: actor._id,
    targetUserId: user._id,
    metadata: {
      email: user.email,
    },
  });

  await RbacAuditLog.create({
    action: "PASSWORD_RESET",
    performedBy: actor._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
    metadata: {
      email: user.email,
      role: user.role,
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

  const actor = req.user;
  const actorManageableRoles = Array.isArray(actor.manageableRoles) ? actor.manageableRoles : [];
  if (user.role === USER_ROLES.SUPER_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "You cannot pause a super admin user");
  }
  if (!actorManageableRoles.includes(user.role)) {
    throw new ApiError(403, "You are not allowed to pause users with this role");
  }

  if (String(req.user._id) === String(user._id)) {
    throw new ApiError(400, "You cannot pause your own account");
  }

  const isOwner = String(user.createdBy || "") === String(req.user._id);
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && !isOwner) {
    throw new ApiError(403, "You can only pause users you created");
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

  await RbacAuditLog.create({
    action: "USER_PAUSED",
    performedBy: req.user._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
    metadata: {
      email: user.email,
      role: user.role,
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

  const actor = req.user;
  const actorManageableRoles = Array.isArray(actor.manageableRoles) ? actor.manageableRoles : [];
  if (user.role === USER_ROLES.SUPER_ADMIN && actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "You cannot resume a super admin user");
  }
  if (!actorManageableRoles.includes(user.role)) {
    throw new ApiError(403, "You are not allowed to resume users with this role");
  }

  const isOwner = String(user.createdBy || "") === String(req.user._id);
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && !isOwner) {
    throw new ApiError(403, "You can only resume users you created");
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

  await RbacAuditLog.create({
    action: "USER_RESUMED",
    performedBy: req.user._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
    metadata: {
      email: user.email,
      role: user.role,
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

  const actorPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  if (!actorPermissions.includes(PERMISSIONS.DELETE_USER)) {
    throw new ApiError(403, "Missing permission: DELETE_USER");
  }

  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Super admin accounts cannot be deleted");
  }

  const isOwner = String(user.createdBy || "") === String(req.user._id);
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && !isOwner) {
    throw new ApiError(403, "You can only delete users you created");
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

  await RbacAuditLog.create({
    action: "USER_DELETED",
    performedBy: req.user._id,
    targetId: user._id,
    targetType: RBAC_AUDIT_TARGET_TYPES.USER,
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
