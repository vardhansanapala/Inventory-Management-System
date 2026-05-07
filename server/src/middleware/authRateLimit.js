const { ApiError } = require("../utils/ApiError");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_CHANGE_PASSWORD_ATTEMPTS = 5;
const attemptsByKey = new Map();

function getClientKey(req) {
  return `${req.user?._id || "anonymous"}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function cleanupExpiredEntry(key, now) {
  const entry = attemptsByKey.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    attemptsByKey.delete(key);
    return null;
  }

  return entry;
}

function changePasswordRateLimit(req, _res, next) {
  const now = Date.now();
  const key = getClientKey(req);
  const entry = cleanupExpiredEntry(key, now);

  if (entry && entry.count >= MAX_CHANGE_PASSWORD_ATTEMPTS) {
    return next(new ApiError(429, "Too many password change attempts. Please try again later."));
  }

  return next();
}

function registerChangePasswordFailure(req) {
  const now = Date.now();
  const key = getClientKey(req);
  const entry = cleanupExpiredEntry(key, now);

  if (entry) {
    entry.count += 1;
    return;
  }

  attemptsByKey.set(key, {
    count: 1,
    expiresAt: now + WINDOW_MS,
  });
}

function clearChangePasswordFailures(req) {
  attemptsByKey.delete(getClientKey(req));
}

module.exports = {
  changePasswordRateLimit,
  registerChangePasswordFailure,
  clearChangePasswordFailures,
};
