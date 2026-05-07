export const MIN_PASSWORD_LENGTH = 8;

export function getPasswordRequirementChecks(password, currentPassword = "") {
  const normalizedPassword = String(password || "").trim();
  const normalizedCurrentPassword = String(currentPassword || "").trim();

  return [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      satisfied: normalizedPassword.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "lowercase",
      label: "One lowercase letter",
      message: "Password must include at least one lowercase letter.",
      satisfied: /[a-z]/.test(normalizedPassword),
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      message: "Password must include at least one uppercase letter.",
      satisfied: /[A-Z]/.test(normalizedPassword),
    },
    {
      id: "number",
      label: "One number",
      message: "Password must include at least one number.",
      satisfied: /\d/.test(normalizedPassword),
    },
    {
      id: "special",
      label: "One special character",
      message: "Password must include at least one special character.",
      satisfied: /[^A-Za-z0-9]/.test(normalizedPassword),
    },
    {
      id: "different",
      label: "Different from your current password",
      message: "New password must be different from the current password.",
      satisfied: !normalizedCurrentPassword || normalizedPassword !== normalizedCurrentPassword,
    },
  ];
}

export function getPasswordValidationErrors({
  currentPassword = "",
  newPassword = "",
  confirmPassword = "",
  requireCurrentPassword = false,
  disallowReuse = false,
}) {
  const errors = {};
  const requirementChecks = getPasswordRequirementChecks(newPassword, disallowReuse ? currentPassword : "");
  const unmetRequirement = requirementChecks.find((item) => !item.satisfied && (disallowReuse || item.id !== "different"));

  if (requireCurrentPassword && !String(currentPassword || "").trim()) {
    errors.currentPassword = "Current password is required.";
  }

  if (!String(newPassword || "")) {
    errors.newPassword = "New password is required.";
  } else if (unmetRequirement) {
    errors.newPassword = unmetRequirement.message || (unmetRequirement.label.endsWith(".") ? unmetRequirement.label : `${unmetRequirement.label}.`);
  }

  if (disallowReuse && currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = "New password must be different from the current password.";
  }

  if (!String(confirmPassword || "")) {
    errors.confirmPassword = "Please confirm the new password.";
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = "New password and confirm password must match.";
  }

  return errors;
}

export function getPasswordStrengthMeta(password, currentPassword = "") {
  const checks = getPasswordRequirementChecks(password, currentPassword);
  const score = checks.filter((item) => item.satisfied).length;

  if (!password) {
    return { score: 0, label: "Not started", tone: "neutral", checks };
  }

  if (score <= 2) {
    return { score, label: "Weak", tone: "weak", checks };
  }

  if (score <= 4) {
    return { score, label: "Fair", tone: "fair", checks };
  }

  return { score, label: "Strong", tone: "strong", checks };
}

export function generateStrongPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%&*?";
  const all = `${uppercase}${lowercase}${numbers}${special}`;
  const requiredChars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  while (requiredChars.length < 12) {
    requiredChars.push(all[Math.floor(Math.random() * all.length)]);
  }

  return requiredChars.sort(() => Math.random() - 0.5).join("");
}
