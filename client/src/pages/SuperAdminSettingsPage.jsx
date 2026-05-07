import { useMemo, useState } from "react";
import { updateSuperAdminPassword, updateSuperAdminProfile } from "../api/inventory";
import { PasswordField } from "../components/PasswordField";
import { SectionCard } from "../components/SectionCard";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { getPasswordValidationErrors } from "../utils/password.util";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SuperAdminSettingsPage() {
  const { user, setUser } = useAuth();
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const passwordErrors = useMemo(
    () =>
      getPasswordValidationErrors({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
        requireCurrentPassword: true,
        disallowReuse: true,
      }),
    [passwordForm]
  );

  if (user?.role !== ROLES.SUPER_ADMIN) {
    return <div className="page-message error">Only Super Admins can access security settings.</div>;
  }

  function togglePasswordVisibility(key) {
    setVisiblePasswords((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const response = await updateSuperAdminProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
        currentPassword: profileForm.currentPassword,
      });
      setUser(response.user);
      setProfileForm((current) => ({ ...current, currentPassword: "" }));
      setProfileMessage("Profile updated securely.");
    } catch (error) {
      setProfileError(error.message || "Unable to update profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (Object.keys(passwordErrors).length) {
      setPasswordError(Object.values(passwordErrors)[0]);
      return;
    }

    setPasswordBusy(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      await updateSuperAdminPassword(passwordForm);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Password updated securely.");
    } catch (error) {
      setPasswordError(error.message || "Unable to update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="page-stack super-admin-settings-page">
      <SectionCard
        title="Security Settings"
        subtitle="Update the Super Admin identity only after confirming the current password."
      >
        <form className="settings-form" onSubmit={handleProfileSubmit}>
          {profileError ? <div className="page-message error">{profileError}</div> : null}
          {profileMessage ? <div className="page-message success">{profileMessage}</div> : null}
          <div className="form-grid">
            <label className="field-stack">
              <span>First Name</span>
              <input
                className="input"
                value={profileForm.firstName}
                onChange={(event) => setProfileForm({ ...profileForm, firstName: event.target.value })}
                required
              />
            </label>
            <label className="field-stack">
              <span>Last Name</span>
              <input
                className="input"
                value={profileForm.lastName}
                onChange={(event) => setProfileForm({ ...profileForm, lastName: event.target.value })}
                required
              />
            </label>
            <label className="field-stack">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })}
                required
              />
            </label>
            <PasswordField
              id="profile-current-password"
              label="Current Password"
              value={profileForm.currentPassword}
              onChange={(value) => setProfileForm({ ...profileForm, currentPassword: value })}
              visible={Boolean(visiblePasswords.profileCurrent)}
              onToggle={() => togglePasswordVisibility("profileCurrent")}
              placeholder="Confirm your current password"
              autoComplete="current-password"
            />
          </div>
          <div className="settings-actions">
            <button className="button dark button-rect" type="submit" disabled={profileBusy}>
              {profileBusy ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Change Password" subtitle="Use a strong password and confirm your current password.">
        <form className="settings-form" onSubmit={handlePasswordSubmit}>
          {passwordError ? <div className="page-message error">{passwordError}</div> : null}
          {passwordMessage ? <div className="page-message success">{passwordMessage}</div> : null}
          <div className="form-grid">
            <PasswordField
              id="password-current-password"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}
              visible={Boolean(visiblePasswords.passwordCurrent)}
              onToggle={() => togglePasswordVisibility("passwordCurrent")}
              placeholder="Current password"
              autoComplete="current-password"
              error={passwordErrors.currentPassword}
            />
            <PasswordField
              id="password-new-password"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
              visible={Boolean(visiblePasswords.newPassword)}
              onToggle={() => togglePasswordVisibility("newPassword")}
              error={passwordErrors.newPassword}
            />
            <PasswordField
              id="password-confirm-password"
              label="Confirm Password"
              value={passwordForm.confirmPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
              visible={Boolean(visiblePasswords.confirmPassword)}
              onToggle={() => togglePasswordVisibility("confirmPassword")}
              placeholder="Confirm new password"
              error={passwordErrors.confirmPassword}
            />
          </div>
          <div className="settings-actions">
            <button
              className="button dark button-rect"
              type="submit"
              disabled={passwordBusy || Object.keys(passwordErrors).length > 0}
            >
              {passwordBusy ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
