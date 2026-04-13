const { User } = require("../models/User");
const { ApiError } = require("../utils/ApiError");
const { verifyAuthToken } = require("../utils/jwt");

async function attachUserFromToken(req, _res, next) {
  try {
    const authorizationHeader = req.header("authorization") || "";
    const [scheme, token] = authorizationHeader.split(" ");

    if (!token || scheme !== "Bearer") {
      req.user = null;
      return next();
    }

    const payload = verifyAuthToken(token);

    const user = await User.findOne({
      _id: payload.sub,
      isDeleted: false,
      isActive: true,
    });

    if (!user) {
      return next(new ApiError(401, "Invalid or expired session"));
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(new ApiError(401, "Invalid or expired session"));
  }
}

function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  return next();
}

function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }

    return next();
  };
}

module.exports = {
  attachUserFromToken,
  requireAuth,
  requireRole,
};
