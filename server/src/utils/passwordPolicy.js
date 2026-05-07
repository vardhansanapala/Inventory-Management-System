const { ApiError } = require("./ApiError");

const MIN_PASSWORD_LENGTH = 8;

function normalizePassword(value) {
  return String(value || "").trim();
}

function getPasswordPolicyErrors(password, options = {}) {
  const normalizedPassword = normalizePassword(password);
  const currentPassword = normalizePassword(options.currentPassword);
  const errors = [];

  if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (!/[a-z]/.test(normalizedPassword)) {
    
    
    errors.push("Password must include at least one lowercase letter.");
  }

  if (!/[A-Z]/.test(normalizedPassword))  {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (!/\d/.test(normalizedPassword)) {
    errors.push("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9]/.test(normalizedPassword)) {
    errors.push("Password must include at least one special character.");
  }

  if (currentPassword && normalizedPassword === currentPassword) {
    errors.push("New password must be different from the current password.");
  }

  return errors;
}

function assertStrongPassword(password, options = {}) {
  const errors = getPasswordPolicyErrors(password, options);
  if (errors.length) {
    throw new ApiError(400, errors[0]);
  }
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  normalizePassword,
  getPasswordPolicyErrors,
  assertStrongPassword,
};
