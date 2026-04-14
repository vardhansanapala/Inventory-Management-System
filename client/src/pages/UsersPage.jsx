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
import { ActionMenu } from "../components/ActionMenu";
import { Modal } from "../components/Modal";
import { SectionCard } from "../components/SectionCard";
import { PERMISSIONS, ROLE_DEFAULTS, hasPermission } from "../constants/permissions";
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

  useEffect(() => {
    if (!isSuperAdmin) return;
    const defaults = ROLE_DEFAULTS[createForm.role]?.permissions || [];
    setCreatePermissions((current) => (current.length ? current : defaults));
  }, [createForm.role, isSuperAdmin]);

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
        permissions: isSuperAdmin ? createPermissions : undefined,
        manageableRoles: createForm.role === ROLES.ADMIN && isSuperAdmin ? createManageableRoles : undefined,
      });
      setCreateForm(emptyCreateForm);
      setShowCreatePassword(false);
      setShowCreateConfirm(false);
      setCreateManageableRoles([]);
      setCreatePermissions([]);
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
        permissions: isSuperAdmin ? editPermissions : undefined,
        manageableRoles: isSuperAdmin && editForm.role === ROLES.ADMIN ? editManageableRoles : undefined,
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
    setEditPermissions(Array.isArray(targetUser.permissions) ? targetUser.permissions : []);
    setEditManageableRoles(Array.isArray(targetUser.manageableRoles) ? targetUser.manageableRoles : []);
  }

  function openResetModal(targetUser) {
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
      {message ? <div className="page-message success">{message}</div> : null}
      {error ? <div className="page-message error">{error}</div> : null}

      <SectionCard
        title="User Management"
        subtitle="Create accounts, manage roles, and control account status with super-admin-only actions."
        actions={<span className="role-chip">Permission-aware</span>}
      >
        {canCreateUser ? (
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
          {isSuperAdmin && createForm.role === ROLES.ADMIN ? (
            <div className="field-stack">
              <span>Manageable Roles</span>
              <div className="mini-list">
                {[ROLES.ADMIN, ROLES.EMPLOYEE].map((role) => (
                  <label key={role} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={createManageableRoles.includes(role)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setCreateManageableRoles((current) => {
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
              <p className="table-subtle">SUPER_ADMIN is intentionally not assignable.</p>
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
                <div className="permission-group">
                  <strong className="table-subtle">ASSET MANAGEMENT</strong>
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
                <div className="permission-group">
                  <strong className="table-subtle">PRODUCT / SKU</strong>
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
          ) : null}
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
                      {canSeeUserActions ? (
                        <td>
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
                                onClick: () => setDeleteUserTarget(targetUser),
                              },
                            ]}
                          />
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingUser(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="button dark button-rect" type="button" onClick={handleEdit} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setResetPasswordUser(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="button dark button-rect" type="button" onClick={handlePasswordReset} disabled={!resetFormValid || submitting}>
                {submitting ? "Updating..." : "Update Password"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeleteUserTarget(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="button danger button-rect" type="button" onClick={handleDelete} disabled={submitting}>
                {submitting ? "Deleting..." : "Delete User"}
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
