import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../api/inventory";
import { useAuth } from "../../context/AuthContext";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { getPasswordStrengthMeta, getPasswordValidationErrors } from "../../utils/password.util";
import { ActionFeedback } from "../ActionFeedback";
import { Modal } from "../Modal";
import { PasswordField } from "../PasswordField";

const emptyForm = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

export function ChangePasswordModal({ onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const feedback = useActionFeedback({ preferGlobal: true });
  const [form, setForm] = useState(emptyForm);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validationErrors = useMemo(
    () => getPasswordValidationErrors({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
      confirmPassword: form.confirmNewPassword,
      requireCurrentPassword: true,
      disallowReuse: true,
    }),
    [form]
  );
  const strengthMeta = useMemo(
    () => getPasswordStrengthMeta(form.newPassword, form.currentPassword),
    [form.currentPassword, form.newPassword]
  );
  const isValid = Object.keys(validationErrors).length === 0
    && Boolean(form.currentPassword)
    && Boolean(form.newPassword)
    && Boolean(form.confirmNewPassword);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isValid || feedback.isLoading) {
      return;
    }

    const result = await feedback.handleAsyncAction(
      () => changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmNewPassword: form.confirmNewPassword,
      }),
      {
        loadingMsg: "Updating your password...",
        errorMsg: "Unable to update password.",
        globalError: true,
      }
    );

    if (!result) {
      return;
    }

    feedback.showSuccess(result.message || "Password updated successfully. Please sign in again.", { global: true });
    onClose();
    logout();
    navigate("/login", {
      replace: true,
      state: {
        flashMessage: result.message || "Password updated successfully. Please sign in again.",
      },
    });
  }

  return (
    <Modal
      title="Change Password"
      subtitle="Update your account password and secure your current access."
      onClose={onClose}
      className="change-password-modal"
      feedback={(
        <ActionFeedback
          type={feedback.feedback?.type}
          message={feedback.feedback?.message}
          autoDismissMs={feedback.feedback?.autoDismissMs}
          onClose={feedback.clear}
          className="action-feedback-inline"
        />
      )}
      actions={(
        <>
          <button className="button ghost button-rect" type="button" onClick={onClose} disabled={feedback.isLoading}>
            Cancel
          </button>
          <button
            className="button dark button-rect with-spinner"
            type="submit"
            form="change-password-form"
            disabled={!isValid || feedback.isLoading}
          >
            {feedback.isLoading ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
            <span>{feedback.isLoading ? "Saving..." : "Change Password"}</span>
          </button>
        </>
      )}
    >
      <form id="change-password-form" className="page-stack" onSubmit={handleSubmit}>
        <PasswordField
          id="current-password"
          name="currentPassword"
          label="Current password"
          value={form.currentPassword}
          onChange={(value) => setForm((current) => ({ ...current, currentPassword: value }))}
          visible={showCurrentPassword}
          onToggle={() => setShowCurrentPassword((current) => !current)}
          error={validationErrors.currentPassword}
          placeholder="Enter your current password"
          autoComplete="current-password"
          disabled={feedback.isLoading}
        />

        <PasswordField
          id="new-password"
          name="newPassword"
          label="New password"
          value={form.newPassword}
          onChange={(value) => setForm((current) => ({ ...current, newPassword: value }))}
          visible={showNewPassword}
          onToggle={() => setShowNewPassword((current) => !current)}
          error={validationErrors.newPassword}
          helperText="Use uppercase, lowercase, number, and a special character."
          disabled={feedback.isLoading}
        />

        <div className="password-strength-card" aria-live="polite">
          <div className="password-strength-header">
            <strong>Password strength</strong>
            <span className={`password-strength-pill is-${strengthMeta.tone}`}>{strengthMeta.label}</span>
          </div>
          <div className="password-strength-meter" aria-hidden>
            {Array.from({ length: 6 }, (_, index) => (
              <span key={`password-strength:${index + 1}`} className={index < strengthMeta.score ? `is-${strengthMeta.tone}` : ""} />
            ))}
          </div>
          <div className="password-requirement-list">
            {strengthMeta.checks.map((item) => (
              <div key={item.id} className={`password-requirement${item.satisfied ? " is-met" : ""}`}>
                <span aria-hidden>{item.satisfied ? "OK" : "NO"}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <PasswordField
          id="confirm-new-password"
          name="confirmNewPassword"
          label="Confirm new password"
          value={form.confirmNewPassword}
          onChange={(value) => setForm((current) => ({ ...current, confirmNewPassword: value }))}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((current) => !current)}
          error={validationErrors.confirmPassword}
          placeholder="Re-enter the new password"
          autoComplete="new-password"
          disabled={feedback.isLoading}
        />
      </form>
    </Modal>
  );
}
