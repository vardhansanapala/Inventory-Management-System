import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  pauseUser,
  resetUserPassword,
  resumeUser,
  updateUser,
} from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { ActionMenu } from "../components/ActionMenu";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { PERMISSIONS, ROLE_DEFAULTS, hasPermission } from "../constants/permissions";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { useActionFeedback } from "../hooks/useActionFeedback";

const USER_STATUSES = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
};

const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: ROLES.EMPLOYEE,
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

function PasswordField({ label, value, onChange, visible, onToggle, error, autoComplete = "new-password" }) {
  return (
    <label className="field-stack">
      {label ? <span>{label}</span> : null}
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
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [activeRowFeedbackId, setActiveRowFeedbackId] = useState("");
  const [highlightedUserId, setHighlightedUserId] = useState("");
  const rowFlashTimeoutRef = useRef(null);
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const canCreateUser = hasPermission(currentUser, PERMISSIONS.CREATE_USER);
  const canEditUser = hasPermission(currentUser, PERMISSIONS.EDIT_USER);
  const canDeleteUser = hasPermission(currentUser, PERMISSIONS.DELETE_USER);
  const canResetPassword = hasPermission(currentUser, PERMISSIONS.RESET_PASSWORD);
  const canSeeUserActions = canEditUser || canDeleteUser || canResetPassword;

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [createManageableRoles, setCreateManageableRoles] = useState([]);
  const [createPermissions, setCreatePermissions] = useState([]);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editManageableRoles, setEditManageableRoles] = useState([]);
  const [editPermissions, setEditPermissions] = useState([]);

  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const createFeedback = useActionFeedback({ preferGlobal: true });
  const rowFeedback = useActionFeedback();
  const editFeedback = useActionFeedback();
  const resetFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();

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
      setLoadError("");
      const data = await listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const defaults = ROLE_DEFAULTS[createForm.role]?.permissions || [];
    setCreatePermissions((current) => (current.length ? current : defaults));
  }, [createForm.role, isSuperAdmin]);

  useEffect(() => () => {
    window.clearTimeout(rowFlashTimeoutRef.current);
  }, []);

  function flashUserRow(userId) {
    if (!userId) return;
    setHighlightedUserId(userId);
    window.clearTimeout(rowFlashTimeoutRef.current);
    rowFlashTimeoutRef.current = window.setTimeout(() => {
      setHighlightedUserId("");
    }, 1800);
  }

  async function runUserAction({
    key,
    action,
    feedbackController,
    successMsg,
    errorMsg,
    loadingMsg,
    rowUserId = "",
    afterSuccess,
  }) {
    setBusyKey(key);
    if (rowUserId) {
      setActiveRowFeedbackId(rowUserId);
    }

    const result = await feedbackController.handleAsyncAction(
      async () => {
        const value = await action();
        await fetchUsers();
        return value;
      },
      {
        loadingMsg,
        successMsg,
        errorMsg,
        globalSuccess: !rowUserId,
        globalError: !rowUserId,
      }
    );

    if (result && rowUserId) {
      flashUserRow(rowUserId);
    }

    if (result) {
      afterSuccess?.(result);
    }

    setBusyKey("");
    return result;
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!createFormValid) {
      return;
    }

    await runUserAction({
      key: "create-user",
      feedbackController: createFeedback,
      loadingMsg: "Creating user...",
      successMsg: "User created successfully.",
      errorMsg: "Unable to create user.",
      action: () =>
        createUser({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim(),
          role: createForm.role,
          status: createForm.status,
          password: createForm.password,
          permissions: isSuperAdmin ? createPermissions : undefined,
          manageableRoles: createForm.role === ROLES.ADMIN && isSuperAdmin ? createManageableRoles : undefined,
        }),
      afterSuccess: () => {
        setCreateForm(emptyCreateForm);
        setShowCreatePassword(false);
        setShowCreateConfirm(false);
        setCreateManageableRoles([]);
        setCreatePermissions([]);
      },
    });
  }

  async function handleEdit() {
    if (!editingUser) {
      return;
    }

    await runUserAction({
      key: `edit-user:${editingUser._id}`,
      feedbackController: editFeedback,
      loadingMsg: "Saving user changes...",
      successMsg: "User updated successfully.",
      errorMsg: "Unable to update user.",
      action: () =>
        updateUser(editingUser._id, {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          role: editForm.role,
          status: editForm.status,
          permissions: isSuperAdmin ? editPermissions : undefined,
          manageableRoles: isSuperAdmin && editForm.role === ROLES.ADMIN ? editManageableRoles : undefined,
        }),
      afterSuccess: () => {
        setEditingUser(null);
        editFeedback.clear();
      },
    });
  }

  async function handlePasswordReset() {
    if (!resetPasswordUser || !resetFormValid) {
      return;
    }

    await runUserAction({
      key: `reset-user:${resetPasswordUser._id}`,
      feedbackController: resetFeedback,
      loadingMsg: "Updating password...",
      successMsg: "Password reset successfully.",
      errorMsg: "Unable to reset password.",
      action: () =>
        resetUserPassword(resetPasswordUser._id, {
          password: passwordForm.password,
        }),
      afterSuccess: () => {
        setResetPasswordUser(null);
        setPasswordForm(emptyPasswordForm);
        setShowResetPassword(false);
        setShowResetConfirm(false);
        resetFeedback.clear();
      },
    });
  }

  async function handlePauseResume(targetUser) {
    await runUserAction({
      key: `toggle-user:${targetUser._id}`,
      feedbackController: rowFeedback,
      loadingMsg: targetUser.status === USER_STATUSES.PAUSED ? "Resuming account..." : "Pausing account...",
      successMsg: targetUser.status === USER_STATUSES.PAUSED ? "Account resumed successfully." : "Account paused successfully.",
      errorMsg: targetUser.status === USER_STATUSES.PAUSED ? "Unable to resume account." : "Unable to pause account.",
      rowUserId: targetUser._id,
      action: () => {
        if (targetUser.status === USER_STATUSES.PAUSED) {
          return resumeUser(targetUser._id);
        }
        return pauseUser(targetUser._id);
      },
    });
  }

  async function handleDelete() {
    if (!deleteUserTarget) {
      return;
    }

    await runUserAction({
      key: `delete-user:${deleteUserTarget._id}`,
      feedbackController: deleteFeedback,
      loadingMsg: "Deleting user...",
      successMsg: "User deleted successfully.",
      errorMsg: "Unable to delete user.",
      action: () => deleteUser(deleteUserTarget._id),
      afterSuccess: () => {
        setDeleteUserTarget(null);
        deleteFeedback.clear();
      },
    });
  }

  function openEditModal(targetUser) {
    editFeedback.clear();
    setEditingUser(targetUser);
    setEditForm({
      firstName: targetUser.firstName || "",
      lastName: targetUser.lastName || "",
      role: targetUser.role || ROLES.EMPLOYEE,
      status: targetUser.status || USER_STATUSES.ACTIVE,
    });
    setEditPermissions(Array.isArray(targetUser.permissions) ? targetUser.permissions : []);
    setEditManageableRoles(Array.isArray(targetUser.manageableRoles) ? targetUser.manageableRoles : []);
  }

  function openResetModal(targetUser) {
    resetFeedback.clear();
    setResetPasswordUser(targetUser);
    setPasswordForm(emptyPasswordForm);
    setShowResetPassword(false);
    setShowResetConfirm(false);
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

  const roleOptions = [ROLES.ADMIN, ROLES.EMPLOYEE];

  if (loading) {
    return <div className="page-message">Loading users...</div>;
  }

  return (
    <div className="page-stack users-page">
      {loadError ? <div className="page-message error">{loadError}</div> : null}

      <SectionCard
        title="User Management"
        subtitle="Create accounts, manage roles, and control account status with super-admin-only actions."
        actions={<span className="role-chip">Permission-aware</span>}
      >
        {canCreateUser ? (
        <form className="users-create-form" onSubmit={handleCreate}>
          <div className="users-create-grid">
            <div className="users-form-card">
              <div className="users-form-card-header">
                <strong>Basic Info</strong>
                <span className="table-subtle">Account identity</span>
              </div>
              <div className="users-form-card-body users-two-col">
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
                <label className="field-stack users-span-full">
                  <span>Email</span>
                  <input
                    className="input"
                    type="email"
                    value={createForm.email}
                    onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="users-form-card">
              <div className="users-form-card-header">
                <strong>Role & Status</strong>
                <span className="table-subtle">Controls access scope</span>
              </div>
              <div className="users-form-card-body users-two-col">
                <label className="field-stack">
                  <span>Role</span>
                  <select
                    className="input"
                    value={createForm.role}
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      setCreateForm({ ...createForm, role: nextRole });
                      if (nextRole === ROLES.ADMIN) {
                        setCreateManageableRoles([ROLES.EMPLOYEE]);
                      } else {
                        setCreateManageableRoles([]);
                      }
                      if (isSuperAdmin) {
                        setCreatePermissions(ROLE_DEFAULTS[nextRole]?.permissions || []);
                      }
                    }}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-stack">
                  <span>Status</span>
                  <select
                    className="input"
                    value={createForm.status}
                    onChange={(event) => setCreateForm({ ...createForm, status: event.target.value })}
                  >
                    <option value={USER_STATUSES.ACTIVE}>ACTIVE</option>
                    <option value={USER_STATUSES.PAUSED}>PAUSED</option>
                  </select>
                </label>
              </div>
            </div>

            {isSuperAdmin && createForm.role === ROLES.ADMIN ? (
              <div className="users-form-card">
                <div className="users-form-card-header">
                  <strong>Manageable Roles</strong>
                  <span className="table-subtle">What this admin can create/manage</span>
                </div>
                <div className="users-form-card-body">
                  <div className="users-pill-row" role="group" aria-label="Manageable roles">
                    {[ROLES.ADMIN, ROLES.EMPLOYEE].map((role) => {
                      const isOn = createManageableRoles.includes(role);
                      return (
                        <button
                          key={role}
                          className={isOn ? "users-pill is-on" : "users-pill"}
                          type="button"
                          onClick={() => {
                            setCreateManageableRoles((current) => {
                              if (current.includes(role)) return current.filter((r) => r !== role);
                              return Array.from(new Set([...current, role]));
                            });
                          }}
                          disabled={role === ROLES.SUPER_ADMIN}
                        >
                          <span className="users-pill-label">{role}</span>
                          <span className="users-pill-mark">{isOn ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="table-subtle">SUPER_ADMIN is intentionally not assignable.</p>
                </div>
              </div>
            ) : null}

            {isSuperAdmin ? (
              <div className="users-form-card users-span-full">
                <div className="users-form-card-header">
                  <strong>Permissions</strong>
                  <span className="table-subtle">Fine-grained access overrides</span>
                </div>
                <div className="users-form-card-body">
                  <div className="users-permission-grid">
                    <div className="users-permission-box">
                      <div className="users-permission-box-title">USER MANAGEMENT</div>
                      <div className="users-permission-checks">
                        {[PERMISSIONS.CREATE_USER, PERMISSIONS.EDIT_USER, PERMISSIONS.DELETE_USER, PERMISSIONS.RESET_PASSWORD].map((perm) => (
                          <label key={perm} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={createPermissions.includes(perm)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setCreatePermissions((current) => {
                                  if (checked) return Array.from(new Set([...current, perm]));
                                  return current.filter((p) => p !== perm);
                                });
                              }}
                            />
                            {perm}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="users-permission-box">
                      <div className="users-permission-box-title">ASSET MANAGEMENT</div>
                      <div className="users-permission-checks">
                        {[PERMISSIONS.CREATE_ASSET, PERMISSIONS.UPDATE_ASSET, PERMISSIONS.DELETE_ASSET, PERMISSIONS.ASSIGN_ASSET].map((perm) => (
                          <label key={perm} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={createPermissions.includes(perm)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setCreatePermissions((current) => {
                                  if (checked) return Array.from(new Set([...current, perm]));
                                  return current.filter((p) => p !== perm);
                                });
                              }}
                            />
                            {perm}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="users-permission-box">
                      <div className="users-permission-box-title">PRODUCT / SKU</div>
                      <div className="users-permission-checks">
                        {[PERMISSIONS.CREATE_PRODUCT, PERMISSIONS.EDIT_PRODUCT, PERMISSIONS.DELETE_PRODUCT].map((perm) => (
                          <label key={perm} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={createPermissions.includes(perm)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setCreatePermissions((current) => {
                                  if (checked) return Array.from(new Set([...current, perm]));
                                  return current.filter((p) => p !== perm);
                                });
                              }}
                            />
                            {perm}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="inline-form">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setCreatePermissions(ROLE_DEFAULTS[createForm.role]?.permissions || [])}
                    >
                      Reset to role defaults
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="users-form-card">
              <div className="users-form-card-header">
                <strong>Password</strong>
                <span className="table-subtle">Set initial credentials</span>
              </div>
              <div className="users-form-card-body users-password-stack">
                <button className="button ghost users-generate-btn" type="button" onClick={applyGeneratedPassword}>
                  Generate Password
                </button>
                <PasswordField
                  label="Password"
                  value={createForm.password}
                  onChange={(value) => setCreateForm({ ...createForm, password: value })}
                  visible={showCreatePassword}
                  onToggle={() => setShowCreatePassword((current) => !current)}
                  error={createPasswordErrors.password}
                />
                <PasswordField
                  label="Confirm Password"
                  value={createForm.confirmPassword}
                  onChange={(value) => setCreateForm({ ...createForm, confirmPassword: value })}
                  visible={showCreateConfirm}
                  onToggle={() => setShowCreateConfirm((current) => !current)}
                  error={createPasswordErrors.confirmPassword}
                />
              </div>
            </div>
          </div>

          <div className="users-create-actions">
            <button className="button users-create-submit with-spinner" type="submit" disabled={!createFormValid || busyKey === "create-user"}>
              {busyKey === "create-user" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
              <span>{busyKey === "create-user" ? "Creating..." : "Create User"}</span>
            </button>
          </div>
          <ActionFeedback
            type={createFeedback.feedback?.type}
            message={createFeedback.feedback?.message}
            autoDismissMs={createFeedback.feedback?.autoDismissMs}
            onClose={createFeedback.clear}
            className="action-feedback-inline"
          />
        </form>
        ) : (
          <div className="page-message">You do not have permission to create users.</div>
        )}
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
                {canSeeUserActions ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((targetUser) => {
                  const isSelf = String(targetUser._id) === String(currentUser?._id);
                  const canPauseResume = !isSelf;
                  const canDelete = !isSelf;

                  return (
                    <tr key={targetUser._id} className={highlightedUserId === targetUser._id ? "row-flash" : ""}>
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
                      {canSeeUserActions ? (
                        <td>
                          <div className="row-feedback-slot">
                          <ActionMenu
                            label={`Actions for ${targetUser.firstName} ${targetUser.lastName}`}
                            items={[
                              {
                                id: "edit",
                                label: "Edit User",
                                icon: "✏️",
                                hidden: !canEditUser,
                                onClick: () => openEditModal(targetUser),
                              },
                              {
                                id: "reset",
                                label: "Reset Password",
                                icon: "🔑",
                                hidden: !canResetPassword,
                                onClick: () => openResetModal(targetUser),
                              },
                              {
                                id: "pauseResume",
                                label: targetUser.status === USER_STATUSES.PAUSED ? "Resume Account" : "Pause Account",
                                icon: targetUser.status === USER_STATUSES.PAUSED ? "▶" : "⏸",
                                hidden: !canPauseResume || !canEditUser,
                                onClick: () => handlePauseResume(targetUser),
                              },
                              {
                                id: "delete",
                                label: "Delete User",
                                icon: "🗑️",
                                hidden: !canDelete || !canDeleteUser,
                                danger: true,
                                onClick: () => {
                                  deleteFeedback.clear();
                                  setDeleteUserTarget(targetUser);
                                },
                              },
                            ]}
                          />
                          {activeRowFeedbackId === targetUser._id ? (
                            <ActionFeedback
                              type={rowFeedback.feedback?.type}
                              message={rowFeedback.feedback?.message}
                              autoDismissMs={rowFeedback.feedback?.autoDismissMs}
                              onClose={() => {
                                rowFeedback.clear();
                                setActiveRowFeedbackId("");
                              }}
                              compact
                              className="action-feedback-row"
                            />
                          ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canSeeUserActions ? 5 : 4}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editingUser ? (
        <Modal
          title="Edit User"
          subtitle={`Email is fixed for ${editingUser.email}`}
          onClose={() => setEditingUser(null)}
          feedback={
            <ActionFeedback
              type={editFeedback.feedback?.type}
              message={editFeedback.feedback?.message}
              autoDismissMs={editFeedback.feedback?.autoDismissMs}
              onClose={editFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingUser(null)} disabled={busyKey === `edit-user:${editingUser._id}`}>
                Cancel
              </button>
              <button className="button dark button-rect with-spinner" type="button" onClick={handleEdit} disabled={busyKey === `edit-user:${editingUser._id}`}>
                {busyKey === `edit-user:${editingUser._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `edit-user:${editingUser._id}` ? "Saving..." : "Save Changes"}</span>
              </button>
            </>
          }
        >
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
            {isSuperAdmin && editForm.role === ROLES.ADMIN ? (
              <div className="field-stack">
                <span>Manageable Roles</span>
                <div className="mini-list">
                  {[ROLES.ADMIN, ROLES.EMPLOYEE].map((role) => (
                    <label key={role} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editManageableRoles.includes(role)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setEditManageableRoles((current) => {
                            if (checked) return Array.from(new Set([...current, role]));
                            return current.filter((r) => r !== role);
                          });
                        }}
                        disabled={role === ROLES.SUPER_ADMIN}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {isSuperAdmin ? (
              <div className="field-stack users-permissions">
                <span>Permissions</span>
                <div className="permission-groups">
                  <div className="permission-group">
                    <strong className="table-subtle">USER MANAGEMENT</strong>
                    {[PERMISSIONS.CREATE_USER, PERMISSIONS.EDIT_USER, PERMISSIONS.DELETE_USER, PERMISSIONS.RESET_PASSWORD].map((perm) => (
                      <label key={perm} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(perm)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setEditPermissions((current) => {
                              if (checked) return Array.from(new Set([...current, perm]));
                              return current.filter((p) => p !== perm);
                            });
                          }}
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
                  <div className="permission-group">
                    <strong className="table-subtle">ASSET MANAGEMENT</strong>
                    {[PERMISSIONS.CREATE_ASSET, PERMISSIONS.UPDATE_ASSET, PERMISSIONS.DELETE_ASSET, PERMISSIONS.ASSIGN_ASSET].map((perm) => (
                      <label key={perm} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(perm)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setEditPermissions((current) => {
                              if (checked) return Array.from(new Set([...current, perm]));
                              return current.filter((p) => p !== perm);
                            });
                          }}
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
                  <div className="permission-group">
                    <strong className="table-subtle">PRODUCT / SKU</strong>
                    {[PERMISSIONS.CREATE_PRODUCT, PERMISSIONS.EDIT_PRODUCT, PERMISSIONS.DELETE_PRODUCT].map((perm) => (
                      <label key={perm} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(perm)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setEditPermissions((current) => {
                              if (checked) return Array.from(new Set([...current, perm]));
                              return current.filter((p) => p !== perm);
                            });
                          }}
                        />
                        {perm}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="inline-form">
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setEditPermissions(ROLE_DEFAULTS[editForm.role]?.permissions || [])}
                  >
                    Reset to role defaults
                  </button>
                </div>
              </div>
            ) : null}
            <label className="field-stack">
              <span>Status</span>
              <select className="input" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                <option value={USER_STATUSES.ACTIVE}>ACTIVE</option>
                <option value={USER_STATUSES.PAUSED}>PAUSED</option>
              </select>
            </label>
          </div>
        </Modal>
      ) : null}

      {resetPasswordUser ? (
        <Modal
          title="Reset Password"
          subtitle={`Set a new password for ${resetPasswordUser.firstName} ${resetPasswordUser.lastName}`}
          onClose={() => setResetPasswordUser(null)}
          feedback={
            <ActionFeedback
              type={resetFeedback.feedback?.type}
              message={resetFeedback.feedback?.message}
              autoDismissMs={resetFeedback.feedback?.autoDismissMs}
              onClose={resetFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setResetPasswordUser(null)} disabled={busyKey === `reset-user:${resetPasswordUser._id}`}>
                Cancel
              </button>
              <button className="button dark button-rect with-spinner" type="button" onClick={handlePasswordReset} disabled={!resetFormValid || busyKey === `reset-user:${resetPasswordUser._id}`}>
                {busyKey === `reset-user:${resetPasswordUser._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `reset-user:${resetPasswordUser._id}` ? "Updating..." : "Update Password"}</span>
              </button>
            </>
          }
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
        </Modal>
      ) : null}

      {deleteUserTarget ? (
        <Modal
          title="Delete User"
          subtitle={`This will soft-delete ${deleteUserTarget.firstName} ${deleteUserTarget.lastName}.`}
          onClose={() => setDeleteUserTarget(null)}
          feedback={
            <ActionFeedback
              type={deleteFeedback.feedback?.type}
              message={deleteFeedback.feedback?.message}
              autoDismissMs={deleteFeedback.feedback?.autoDismissMs}
              onClose={deleteFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeleteUserTarget(null)} disabled={busyKey === `delete-user:${deleteUserTarget._id}`}>
                Cancel
              </button>
              <button className="button danger button-rect with-spinner" type="button" onClick={handleDelete} disabled={busyKey === `delete-user:${deleteUserTarget._id}`}>
                {busyKey === `delete-user:${deleteUserTarget._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `delete-user:${deleteUserTarget._id}` ? "Deleting..." : "Delete User"}</span>
              </button>
            </>
          }
        >
          <p>This action cannot be undone.</p>
        </Modal>
      ) : null}
    </div>
  );
}
