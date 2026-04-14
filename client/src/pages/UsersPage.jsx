import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  pauseUser,
  resetUserPassword,
  resumeUser,
  updateUser,
} from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";

const USER_STATUSES = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
};

const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: ROLES.ADMIN,
  status: USER_STATUSES.ACTIVE,
  password: "",
  confirmPassword: "",
};

const emptyPasswordForm = {
  password: "",
  confirmPassword: "",
};

const emptyEditForm = {
  firstName: "",
  lastName: "",
  role: ROLES.EMPLOYEE,
  status: USER_STATUSES.ACTIVE,
};

function getPasswordErrors(password, confirmPassword) {
  const errors = {};

  if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (confirmPassword && password !== confirmPassword) {
    errors.confirmPassword = "Passwords must match.";
  }

  return errors;
}

function generateStrongPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const length = 12;
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
}

function UserModal({ title, subtitle, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal users-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="table-subtle">{subtitle}</p> : null}
          </div>
          <button className="icon-action-button" type="button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, error, autoComplete = "new-password" }) {
  return (
    <label className="field-stack">
      <span>{label}</span>
      <div className="password-field">
        <input
          className="input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button className="button ghost password-toggle" type="button" onClick={onToggle} title={visible ? "Hide password" : "Show password"}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </label>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openActionsFor, setOpenActionsFor] = useState(null);

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  const createPasswordErrors = getPasswordErrors(createForm.password, createForm.confirmPassword);
  const resetPasswordErrors = getPasswordErrors(passwordForm.password, passwordForm.confirmPassword);

  const createFormValid = useMemo(() => {
    return (
      Boolean(createForm.firstName.trim()) &&
      Boolean(createForm.lastName.trim()) &&
      Boolean(createForm.email.trim()) &&
      createForm.password.length >= 6 &&
      createForm.password === createForm.confirmPassword
    );
  }, [createForm]);

  const resetFormValid = useMemo(() => {
    return passwordForm.password.length >= 6 && passwordForm.password === passwordForm.confirmPassword;
  }, [passwordForm]);

  async function fetchUsers() {
    try {
      setError("");
      const data = await listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function withRefresh(run, successMessage) {
    try {
      setSubmitting(true);
      setMessage("");
      setError("");
      await run();
      await fetchUsers();
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setOpenActionsFor(null);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!createFormValid) {
      return;
    }

    await withRefresh(async () => {
      await createUser({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        status: createForm.status,
        password: createForm.password,
      });
      setCreateForm(emptyCreateForm);
      setShowCreatePassword(false);
      setShowCreateConfirm(false);
    }, "User created successfully.");
  }

  async function handleEdit() {
    if (!editingUser) {
      return;
    }

    await withRefresh(async () => {
      await updateUser(editingUser._id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        role: editForm.role,
        status: editForm.status,
      });
      setEditingUser(null);
    }, "User updated successfully.");
  }

  async function handlePasswordReset() {
    if (!resetPasswordUser || !resetFormValid) {
      return;
    }

    await withRefresh(async () => {
      await resetUserPassword(resetPasswordUser._id, {
        password: passwordForm.password,
      });
      setResetPasswordUser(null);
      setPasswordForm(emptyPasswordForm);
      setShowResetPassword(false);
      setShowResetConfirm(false);
    }, "Password reset successfully.");
  }

  async function handlePauseResume(targetUser) {
    await withRefresh(async () => {
      if (targetUser.status === USER_STATUSES.PAUSED) {
        await resumeUser(targetUser._id);
      } else {
        await pauseUser(targetUser._id);
      }
    }, targetUser.status === USER_STATUSES.PAUSED ? "Account resumed successfully." : "Account paused successfully.");
  }

  async function handleDelete() {
    if (!deleteUserTarget) {
      return;
    }

    await withRefresh(async () => {
      await deleteUser(deleteUserTarget._id);
      setDeleteUserTarget(null);
    }, "User deleted successfully.");
  }

  function openEditModal(targetUser) {
    setEditingUser(targetUser);
    setEditForm({
      firstName: targetUser.firstName || "",
      lastName: targetUser.lastName || "",
      role: targetUser.role || ROLES.EMPLOYEE,
      status: targetUser.status || USER_STATUSES.ACTIVE,
    });
    setOpenActionsFor(null);
  }

  function openResetModal(targetUser) {
    setResetPasswordUser(targetUser);
    setPasswordForm(emptyPasswordForm);
    setShowResetPassword(false);
    setShowResetConfirm(false);
    setOpenActionsFor(null);
  }

  function applyGeneratedPassword() {
    const generated = generateStrongPassword();
    setCreateForm((current) => ({
      ...current,
      password: generated,
      confirmPassword: generated,
    }));
    setShowCreatePassword(true);
    setShowCreateConfirm(true);
  }

  const roleOptions = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.EMPLOYEE];

  if (loading) {
    return <div className="page-message">Loading users...</div>;
  }

  return (
    <div className="page-stack users-page">
      {message ? <div className="page-message success">{message}</div> : null}
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard
        title="User Management"
        subtitle="Create accounts, manage roles, and control account status with super-admin-only actions."
        actions={<span className="role-chip">Super admin only</span>}
      >
        <form className="form-grid users-form-grid" onSubmit={handleCreate}>
          <label className="field-stack">
            <span>First Name</span>
            <input
              className="input"
              value={createForm.firstName}
              onChange={(event) => setCreateForm({ ...createForm, firstName: event.target.value })}
              required
            />
          </label>
          <label className="field-stack">
            <span>Last Name</span>
            <input
              className="input"
              value={createForm.lastName}
              onChange={(event) => setCreateForm({ ...createForm, lastName: event.target.value })}
              required
            />
          </label>
          <label className="field-stack">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              required
            />
          </label>
          <label className="field-stack">
            <span>Role</span>
            <select className="input" value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="field-stack">
            <span>Status</span>
            <select className="input" value={createForm.status} onChange={(event) => setCreateForm({ ...createForm, status: event.target.value })}>
              <option value={USER_STATUSES.ACTIVE}>ACTIVE</option>
              <option value={USER_STATUSES.PAUSED}>PAUSED</option>
            </select>
          </label>
          <div className="field-stack">
            <span>Password</span>
            <div className="inline-form">
              <button className="button ghost" type="button" onClick={applyGeneratedPassword}>
                Generate Password
              </button>
            </div>
            <PasswordField
              label=""
              value={createForm.password}
              onChange={(value) => setCreateForm({ ...createForm, password: value })}
              visible={showCreatePassword}
              onToggle={() => setShowCreatePassword((current) => !current)}
              error={createPasswordErrors.password}
            />
          </div>
          <PasswordField
            label="Confirm Password"
            value={createForm.confirmPassword}
            onChange={(value) => setCreateForm({ ...createForm, confirmPassword: value })}
            visible={showCreateConfirm}
            onToggle={() => setShowCreateConfirm((current) => !current)}
            error={createPasswordErrors.confirmPassword}
          />
          <button className="button" type="submit" disabled={!createFormValid || submitting}>
            {submitting ? "Creating..." : "Create User"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Users" subtitle="Only active and paused accounts are shown here. Deleted users are soft removed.">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((targetUser) => {
                  const isSelf = String(targetUser._id) === String(currentUser?._id);
                  const canPauseResume = !isSelf;
                  const canDelete = !isSelf;

                  return (
                    <tr key={targetUser._id}>
                      <td>
                        <strong>
                          {targetUser.firstName} {targetUser.lastName}
                        </strong>
                      </td>
                      <td>{targetUser.email}</td>
                      <td>{targetUser.role}</td>
                      <td>
                        <span className={`user-status-badge ${targetUser.status === USER_STATUSES.PAUSED ? "is-paused" : "is-active"}`}>
                          {targetUser.status || USER_STATUSES.ACTIVE}
                        </span>
                      </td>
                      <td>
                        <div className="actions-dropdown">
                          <button
                            className="icon-action-button"
                            type="button"
                            title="User actions"
                            aria-label={`Open actions for ${targetUser.firstName} ${targetUser.lastName}`}
                            onClick={() => setOpenActionsFor(openActionsFor === targetUser._id ? null : targetUser._id)}
                          >
                            ⋮
                          </button>
                          {openActionsFor === targetUser._id ? (
                            <div className="actions-menu" role="menu">
                              <button type="button" className="actions-menu-item" title="Edit user" onClick={() => openEditModal(targetUser)}>
                                <span aria-hidden>✎</span>
                                <span>Edit User</span>
                              </button>
                              <button type="button" className="actions-menu-item" title="Reset password" onClick={() => openResetModal(targetUser)}>
                                <span aria-hidden>⌁</span>
                                <span>Reset Password</span>
                              </button>
                              {canPauseResume ? (
                                <button type="button" className="actions-menu-item" title="Pause or resume user" onClick={() => handlePauseResume(targetUser)}>
                                  <span aria-hidden>{targetUser.status === USER_STATUSES.PAUSED ? "▶" : "⏸"}</span>
                                  <span>{targetUser.status === USER_STATUSES.PAUSED ? "Resume Account" : "Pause Account"}</span>
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  className="actions-menu-item danger"
                                  title="Delete user"
                                  onClick={() => {
                                    setDeleteUserTarget(targetUser);
                                    setOpenActionsFor(null);
                                  }}
                                >
                                  <span aria-hidden>⌦</span>
                                  <span>Delete User</span>
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingUser ? (
        <UserModal title="Edit User" subtitle={`Email is fixed for ${editingUser.email}`} onClose={() => setEditingUser(null)}>
          <div className="form-grid">
            <label className="field-stack">
              <span>First Name</span>
              <input
                className="input"
                value={editForm.firstName}
                onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })}
              />
            </label>
            <label className="field-stack">
              <span>Last Name</span>
              <input
                className="input"
                value={editForm.lastName}
                onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
              />
            </label>
            <label className="field-stack">
              <span>Role</span>
              <select className="input" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span>Status</span>
              <select className="input" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                <option value={USER_STATUSES.ACTIVE}>ACTIVE</option>
                <option value={USER_STATUSES.PAUSED}>PAUSED</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button className="button ghost" type="button" onClick={() => setEditingUser(null)} disabled={submitting}>
              Cancel
            </button>
            <button className="button" type="button" onClick={handleEdit} disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </UserModal>
      ) : null}

      {resetPasswordUser ? (
        <UserModal
          title="Reset Password"
          subtitle={`Set a new password for ${resetPasswordUser.firstName} ${resetPasswordUser.lastName}`}
          onClose={() => setResetPasswordUser(null)}
        >
          <div className="form-grid">
            <PasswordField
              label="New Password"
              value={passwordForm.password}
              onChange={(value) => setPasswordForm({ ...passwordForm, password: value })}
              visible={showResetPassword}
              onToggle={() => setShowResetPassword((current) => !current)}
              error={resetPasswordErrors.password}
            />
            <PasswordField
              label="Confirm Password"
              value={passwordForm.confirmPassword}
              onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
              visible={showResetConfirm}
              onToggle={() => setShowResetConfirm((current) => !current)}
              error={resetPasswordErrors.confirmPassword}
            />
          </div>
          <div className="modal-actions">
            <button className="button ghost" type="button" onClick={() => setResetPasswordUser(null)} disabled={submitting}>
              Cancel
            </button>
            <button className="button" type="button" onClick={handlePasswordReset} disabled={!resetFormValid || submitting}>
              {submitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </UserModal>
      ) : null}

      {deleteUserTarget ? (
        <UserModal
          title="Delete User"
          subtitle={`This will soft-delete ${deleteUserTarget.firstName} ${deleteUserTarget.lastName}.`}
          onClose={() => setDeleteUserTarget(null)}
        >
          <p>This action cannot be undone.</p>
          <div className="modal-actions">
            <button className="button ghost" type="button" onClick={() => setDeleteUserTarget(null)} disabled={submitting}>
              Cancel
            </button>
            <button className="button danger" type="button" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </UserModal>
      ) : null}
    </div>
  );
}
