const { User } = require("../models/User");
const { USER_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");
const { comparePassword } = require("../utils/password");
const { signAuthToken } = require("../utils/jwt");
const { toPublicUser } = require("../utils/userSerializer");

async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "").trim();

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({
    email,
    isDeleted: false,
    isActive: true,
    status: { $in: [USER_STATUSES.ACTIVE, null] },
  }).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signAuthToken(user);

  res.json({
    token,
    user: toPublicUser(user),
  });
}

async function getCurrentUser(req, res) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  res.json({
    user: toPublicUser(req.user),
  });
}

module.exports = {
  login,
  getCurrentUser,
};

