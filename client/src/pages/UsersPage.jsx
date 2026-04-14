import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUser,
  deleteUser,
  listUsers,
  pauseUser,
  resetUserPassword,
  resumeUser,
  updateUser,
} from "../api/inventory";
import { ROLES } from "../constants/roles.js";
import { useAuth } from "../context/AuthContext";
import { SectionCard } from "../components/SectionCard";

const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: ROLES.ADMIN,
  isActive: true,
  password: "",
  confirmPassword: "",
};

const emptyPasswordForm = {
  password: "",
  confirmPassword: "",
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

export function UsersPage({ refreshSetupData }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const canViewUsers = Boolean(currentUser);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [openActionsFor, setOpenActionsFor] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    role: ROLES.EMPLOYEE,
    isActive: true,
  });

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

  useEffect(() => {
    if (!canViewUsers) {
      navigate("/");
    }
  }, [canViewUsers, navigate]);

  const fetchUsers = async () => {
    try {
      setError("");
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewUsers) {
      fetchUsers();
    }
  }, [canViewUsers]);

  const withUserRefresh = async (run, successMessage) => {
    try {
      setError("");
      setMessage("");
      setSubmitting(true);
      await run();
      await fetchUsers();
      if (refreshSetupData) {
        await refreshSetupData();
      }
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setOpenActionsFor(null);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!createFormValid) {
      return;
    }

    await withUserRefresh(async () => {
      await createUser({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        isActive: createForm.isActive,
        password: createForm.password,
      });
      setCreateForm(emptyCreateForm);
    }, "User created successfully.");
  };

  const openEditModal = (user) => {
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || ROLES.EMPLOYEE,
      isActive: user.status !== "PAUSED" && Boolean(user.isActive),
    });
    setEditingUser(user);
  };

  const handleEdit = async () => {
    if (!editingUser) {
      return;
    }

    await withUserRefresh(async () => {
      await updateUser(editingUser._id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      });
      setEditingUser(null);
    }, "User updated successfully.");
  };

  const handlePasswordReset = async () => {
    if (!resetPasswordUser || !resetFormValid) {
      return;
    }

    await withUserRefresh(async () => {
      await resetUserPassword(resetPasswordUser._id, {
        password: passwordForm.password,
      });
      setResetPasswordUser(null);
      setPasswordForm(emptyPasswordForm);
    }, "Password updated successfully.");
  };

  const handlePauseResume = async (user) => {
    await withUserRefresh(async () => {
      if (user.status === "PAUSED") {
        await resumeUser(user._id);
      } else {
        await pauseUser(user._id);
      }
    }, user.status === "PAUSED" ? "User resumed successfully." : "User paused successfully.");
  };

  const handleDelete = async () => {
    if (!deleteUserTarget) {
      return;
    }

    await withUserRefresh(async () => {
      await deleteUser(deleteUserTarget._id);
      setDeleteUserTarget(null);
    }, "User deleted successfully.");
  };

  const getActions = (targetUser) => {
    const canEdit = isSuperAdmin;
    const canReset = isSuperAdmin;
    const canPauseResume = isSuperAdmin && targetUser._id !== currentUser?._id;
    const canDelete = isSuperAdmin && targetUser._id !== currentUser?._id;

    return [
      {
        id: "edit",
        label: "Edit User",
        icon: "✏",
        hidden: !canEdit,
        onClick: () => openEditModal(targetUser),
      },
      {
        id: "reset",
        label: "Reset Password",
        icon: "🔐",
        hidden: !canReset,
        onClick: () => setResetPasswordUser(targetUser),
      },
      {
        id: "pauseResume",
        label: targetUser.status === "PAUSED" ? "Resume Account" : "Pause Account",
        icon: targetUser.status === "PAUSED" ? "▶" : "⏸",
        hidden: !canPauseResume,
        onClick: () => handlePauseResume(targetUser),
      },
      {
        id: "delete",
        label: "Delete User",
        icon: "🗑",
        hidden: !canDelete,
        danger: true,
        onClick: () => setDeleteUserTarget(targetUser),
      },
    ].filter((action) => !action.hidden);
  };

  if (!canViewUsers) {
    return null;
  }

  return (
    <div className="page-stack users-page">
      {message && <div className="page-message success">{message}</div>}
      {error && <div className="page-message error">{error}</div>}

      {isSuperAdmin ? (
      <SectionCard title="Create User" subtitle="Add new team members with secure password setup.">
        <form className="form-grid users-form-grid" onSubmit={handleCreate}>
          <input
            className="input"
            name="firstName"
            placeholder="First Name"
            value={createForm.firstName}
            onChange={(event) => setCreateForm({ ...createForm, firstName: event.target.value })}
          />
          <input
            className="input"
            name="lastName"
            placeholder="Last Name"
            value={createForm.lastName}
            onChange={(event) => setCreateForm({ ...createForm, lastName: event.target.value })}
          />
          <input
            className="input"
            type="email"
            name="email"
            placeholder="Email"
            value={createForm.email}
            onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
          />
          <select
            className="input"
            name="role"
            value={createForm.role}
            onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
          >
            {isSuperAdmin ? <option value={ROLES.SUPER_ADMIN}>{ROLES.SUPER_ADMIN}</option> : null}
            <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
            <option value={ROLES.EMPLOYEE}>{ROLES.EMPLOYEE}</option>
          </select>
          <div>
            <input
              className="input"
              type="password"
              name="password"
              placeholder="Password"
              value={createForm.password}
              onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
            />
            {createPasswordErrors.password ? <p className="field-error">{createPasswordErrors.password}</p> : null}
          </div>
          <div>
            <input
              className="input"
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={createForm.confirmPassword}
              onChange={(event) => setCreateForm({ ...createForm, confirmPassword: event.target.value })}
            />
            {createPasswordErrors.confirmPassword ? (
              <p className="field-error">{createPasswordErrors.confirmPassword}</p>
            ) : null}
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(event) => setCreateForm({ ...createForm, isActive: event.target.checked })}
            />
            Active account
          </label>
          <button className="button" type="submit" disabled={!createFormValid || submitting}>
            {submitting ? "Adding..." : "Add User"}
          </button>
        </form>
      </SectionCard>
      ) : null}

      <SectionCard title="Users List" subtitle="Manage access, status, and account lifecycle.">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {isSuperAdmin ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {!loading && users.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="table-subtle">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <strong>
                        {user.firstName} {user.lastName}
                      </strong>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`user-status-badge ${user.status === "PAUSED" ? "is-paused" : "is-active"}`}>
                        {user.status || (user.isActive ? "ACTIVE" : "PAUSED")}
                      </span>
                    </td>
                    {isSuperAdmin ? (
                      <td>
                        <div className="actions-dropdown">
                          <button
                            className="icon-action-button"
                            type="button"
                            title="User actions"
                            aria-label={`Open actions for ${user.firstName} ${user.lastName}`}
                            onClick={() => setOpenActionsFor(openActionsFor === user._id ? null : user._id)}
                          >
                            ⋮
                          </button>
                          {openActionsFor === user._id ? (
                            <div className="actions-menu" role="menu">
                              {getActions(user).map((action) => (
                                <button
                                  key={action.id}
                                  type="button"
                                  className={`actions-menu-item ${action.danger ? "danger" : ""}`}
                                  title={action.label}
                                  onClick={action.onClick}
                                >
                                  <span aria-hidden>{action.icon}</span>
                                  <span>{action.label}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {isSuperAdmin && editingUser ? (
        <div className="modal-overlay">
          <div className="modal users-modal">
            <h2>Edit User</h2>
            <p className="table-subtle">Email cannot be updated: {editingUser.email}</p>
            <div className="form-grid">
              <input
                className="input"
                placeholder="First Name"
                value={editForm.firstName}
                onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })}
              />
              <input
                className="input"
                placeholder="Last Name"
                value={editForm.lastName}
                onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })}
              />
              <select
                className="input"
                value={editForm.role}
                onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
              >
                {isSuperAdmin ? <option value={ROLES.SUPER_ADMIN}>{ROLES.SUPER_ADMIN}</option> : null}
                <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
                <option value={ROLES.EMPLOYEE}>{ROLES.EMPLOYEE}</option>
              </select>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="modal-actions">
              <button className="button ghost" type="button" onClick={() => setEditingUser(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="button" type="button" onClick={handleEdit} disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSuperAdmin && resetPasswordUser ? (
        <div className="modal-overlay">
          <div className="modal users-modal">
            <h2>Reset Password</h2>
            <div className="form-grid">
              <div>
                <input
                  className="input"
                  type="password"
                  placeholder="New Password"
                  value={passwordForm.password}
                  onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
                />
                {resetPasswordErrors.password ? <p className="field-error">{resetPasswordErrors.password}</p> : null}
              </div>
              <div>
                <input
                  className="input"
                  type="password"
                  placeholder="Confirm Password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                />
                {resetPasswordErrors.confirmPassword ? (
                  <p className="field-error">{resetPasswordErrors.confirmPassword}</p>
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  setResetPasswordUser(null);
                  setPasswordForm(emptyPasswordForm);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button className="button" type="button" onClick={handlePasswordReset} disabled={!resetFormValid || submitting}>
                {submitting ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSuperAdmin && deleteUserTarget ? (
        <div className="modal-overlay">
          <div className="modal users-modal">
            <h2>Delete User?</h2>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="button ghost" type="button" onClick={() => setDeleteUserTarget(null)} disabled={submitting}>
                Cancel
              </button>
              <button className="button danger" type="button" onClick={handleDelete} disabled={submitting}>
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

