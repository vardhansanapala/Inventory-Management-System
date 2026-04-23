import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
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
import { UserAssignedAssetsModal } from "../components/UserAssignedAssetsModal";
import {
  EditPermissionSections,
  PasswordField,
  USER_ROLE_FILTER_OPTIONS,
  USER_ROLE_OPTIONS,
  USER_STATUSES,
  emptyEditForm,
  emptyPasswordForm,
  getPasswordErrors,
} from "../components/users/UserManagementShared";
import { PERMISSIONS, hasPermission } from "../constants/permissions";
import { ROLES } from "../constants/roles";
import { useAuth } from "../context/AuthContext";
import { useActionFeedback } from "../hooks/useActionFeedback";
import { getFullDateTime, getLastUpdatedValue, getRelativeTime, getSortableTime } from "../utils/date.util";

const USERS_PER_PAGE = 10;

function getUserSearchValue(targetUser) {
  return `${targetUser?.firstName || ""} ${targetUser?.lastName || ""} ${targetUser?.email || ""}`.toLowerCase();
}

export function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sort, setSort] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [, forceRelativeRefresh] = useState(0);
  const [activeRowFeedbackId, setActiveRowFeedbackId] = useState("");
  const [highlightedUserId, setHighlightedUserId] = useState("");
  const rowFlashTimeoutRef = useRef(null);

  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const canCreateUser = hasPermission(currentUser, PERMISSIONS.CREATE_USER);
  const canEditUser = hasPermission(currentUser, PERMISSIONS.EDIT_USER);
  const canDeleteUser = hasPermission(currentUser, PERMISSIONS.DELETE_USER);
  const canResetPassword = hasPermission(currentUser, PERMISSIONS.RESET_PASSWORD);
  const canViewAssignedDevices = currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.SUPER_ADMIN;
  const canSeeUserActions = canEditUser || canDeleteUser || canResetPassword;
  const showUserActionsColumn = canSeeUserActions || canViewAssignedDevices;

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editManageableRoles, setEditManageableRoles] = useState([]);
  const [editPermissions, setEditPermissions] = useState([]);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);

  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deviceViewerUser, setDeviceViewerUser] = useState(null);
  const rowFeedback = useActionFeedback();
  const editFeedback = useActionFeedback();
  const resetFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();

  const resetPasswordErrors = getPasswordErrors(passwordForm.password, passwordForm.confirmPassword);
  const resetFormValid = useMemo(() => {
    return passwordForm.password.length >= 6 && passwordForm.password === passwordForm.confirmPassword;
  }, [passwordForm]);

  useEffect(() => {
    const id = window.setInterval(() => {
      forceRelativeRefresh((value) => value + 1);
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();

    const searchFiltered = normalizedSearch
      ? users.filter((targetUser) => getUserSearchValue(targetUser).includes(normalizedSearch))
      : users;

    const roleFiltered = roleFilter === "ALL"
      ? searchFiltered
      : searchFiltered.filter((targetUser) => targetUser.role === roleFilter);

    const sorted = [...roleFiltered].sort((left, right) => {
      const leftTime = getSortableTime(getLastUpdatedValue(left));
      const rightTime = getSortableTime(getLastUpdatedValue(right));
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    return sorted;
  }, [users, searchInput, roleFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [currentPage, filteredUsers]);

  async function fetchUsers() {
    try {
      setLoadError("");
      const data = await listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => () => {
    window.clearTimeout(rowFlashTimeoutRef.current);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchInput, roleFilter, sort]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (editingUser) {
      setIsPermissionsOpen(false);
    }
  }, [editingUser?._id]);

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

  function toggleEditPermission(permission, checked) {
    setEditPermissions((current) => {
      if (checked) return Array.from(new Set([...current, permission]));
      return current.filter((value) => value !== permission);
    });
  }

  function toggleEditAllPermissions() {
    const allPermissions = new Set(editPermissions);
    const hasAnyMissing = editPermissions.length === 0 || !editPermissions.includes(PERMISSIONS.CREATE_USER) || !editPermissions.includes(PERMISSIONS.EDIT_USER) || !editPermissions.includes(PERMISSIONS.DELETE_USER) || !editPermissions.includes(PERMISSIONS.RESET_PASSWORD) || !editPermissions.includes(PERMISSIONS.CREATE_ASSET) || !editPermissions.includes(PERMISSIONS.UPDATE_ASSET) || !editPermissions.includes(PERMISSIONS.DELETE_ASSET) || !editPermissions.includes(PERMISSIONS.ASSIGN_ASSET) || !editPermissions.includes(PERMISSIONS.CREATE_PRODUCT) || !editPermissions.includes(PERMISSIONS.EDIT_PRODUCT) || !editPermissions.includes(PERMISSIONS.DELETE_PRODUCT);

    if (hasAnyMissing) {
      allPermissions.add(PERMISSIONS.CREATE_USER);
      allPermissions.add(PERMISSIONS.EDIT_USER);
      allPermissions.add(PERMISSIONS.DELETE_USER);
      allPermissions.add(PERMISSIONS.RESET_PASSWORD);
      allPermissions.add(PERMISSIONS.CREATE_ASSET);
      allPermissions.add(PERMISSIONS.UPDATE_ASSET);
      allPermissions.add(PERMISSIONS.DELETE_ASSET);
      allPermissions.add(PERMISSIONS.ASSIGN_ASSET);
      allPermissions.add(PERMISSIONS.CREATE_PRODUCT);
      allPermissions.add(PERMISSIONS.EDIT_PRODUCT);
      allPermissions.add(PERMISSIONS.DELETE_PRODUCT);
      setEditPermissions(Array.from(allPermissions));
      return;
    }

    setEditPermissions([]);
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const isEditingLockedSuperAdmin = editingUser?.role === ROLES.SUPER_ADMIN;

  if (loading) {
    return <div className="page-message">Loading users...</div>;
  }

  return (
    <div className="page-stack users-page">
      {loadError ? <div className="page-message error">{loadError}</div> : null}

      <SectionCard
        title="Users"
        subtitle="Only active and paused accounts are shown here. Deleted users are soft removed."
        actions={
          canCreateUser ? (
            <button className="button dark button-rect" type="button" onClick={() => navigate("/users/create")}>
              Create User
            </button>
          ) : (
            <span className="role-chip">Permission-aware</span>
          )
        }
      >
        <div className="users-toolbar">
          <div className="users-filters">
            <label className="field-stack users-filter-field">
              <span>Search</span>
              <input
                className="input"
                type="search"
                placeholder="Search by name or email"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </label>
            <label className="field-stack users-filter-field">
              <span>Role</span>
              <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                {USER_ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack users-filter-field">
              <span>Sort</span>
              <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          </div>
          <div className="table-subtle users-results-count">
            Showing {paginatedUsers.length} of {filteredUsers.length} users
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Updated</th>
                {showUserActionsColumn ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length ? (
                paginatedUsers.map((targetUser) => {
                  const isSelf = String(targetUser._id) === String(currentUser?._id);
                  const isLockedSuperAdmin = targetUser.role === ROLES.SUPER_ADMIN;
                  const canPauseResume = !isSelf;
                  const canDelete = !isSelf;
                  const updatedTime = getSortableTime(getLastUpdatedValue(targetUser));
                  const isRecentlyUpdated = updatedTime && Date.now() - updatedTime <= 5 * 60 * 1000;

                  return (
                    <tr
                      key={targetUser._id}
                      className={[
                        highlightedUserId === targetUser._id ? "row-flash" : "",
                        isRecentlyUpdated ? "row-recent" : "",
                      ].join(" ").trim()}
                    >
                      <td>
                        <strong>
                          {targetUser.firstName} {targetUser.lastName}
                        </strong>
                        <div className="table-subtle">
                          {isLockedSuperAdmin ? "Locked super admin account" : targetUser.employeeCode || "No employee code"}
                        </div>
                      </td>
                      <td>{targetUser.email}</td>
                      <td>
                        <strong>{targetUser.role}</strong>
                      </td>
                      <td>
                        <span className={`user-status-badge ${targetUser.status === USER_STATUSES.PAUSED ? "is-paused" : "is-active"}`}>
                          {targetUser.status || USER_STATUSES.ACTIVE}
                        </span>
                      </td>
                      <td className="table-date">
                        <span title={getFullDateTime(getLastUpdatedValue(targetUser))}>
                          {getRelativeTime(getLastUpdatedValue(targetUser))}
                        </span>
                      </td>
                      {showUserActionsColumn ? (
                        <td>
                          <div className="row-feedback-slot">
                            <div className="users-row-actions">
                              {canSeeUserActions ? (
                                <ActionMenu
                                  label={`Actions for ${targetUser.firstName} ${targetUser.lastName}`}
                                  items={[
                                    {
                                      id: "edit",
                                      label: "Edit User",
                                      icon: "E",
                                      hidden: !canEditUser,
                                      onClick: () => openEditModal(targetUser),
                                    },
                                    {
                                      id: "reset",
                                      label: "Reset Password",
                                      icon: "R",
                                      hidden: !canResetPassword,
                                      onClick: () => openResetModal(targetUser),
                                    },
                                    {
                                      id: "pauseResume",
                                      label: targetUser.status === USER_STATUSES.PAUSED ? "Resume Account" : "Pause Account",
                                      icon: targetUser.status === USER_STATUSES.PAUSED ? ">" : "||",
                                      hidden: !canPauseResume || !canEditUser,
                                      onClick: () => handlePauseResume(targetUser),
                                    },
                                    {
                                      id: "delete",
                                      label: "Delete User",
                                      icon: "X",
                                      hidden: !canDelete || !canDeleteUser,
                                      danger: true,
                                      onClick: () => {
                                        deleteFeedback.clear();
                                        setDeleteUserTarget(targetUser);
                                      },
                                    },
                                  ]}
                                />
                              ) : null}
                            </div>
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
                  <td colSpan={showUserActionsColumn ? 6 : 5}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > USERS_PER_PAGE ? (
          <div className="users-pagination">
            <button
              className="button ghost button-rect button-sm"
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <div className="users-pagination-pages">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={pageNumber === currentPage ? "button dark button-rect button-sm" : "button ghost button-rect button-sm"}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              className="button ghost button-rect button-sm"
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </SectionCard>

      {editingUser ? (
        <Modal
          className="users-edit-modal"
          title="Edit User"
          subtitle={`Email is fixed for ${editingUser.email} | Last updated ${getRelativeTime(getLastUpdatedValue(editingUser))}`}
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
          <div className="users-edit-stack">
            <div className="users-edit-fields">
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
                <select
                  className="input"
                  value={editForm.role}
                  onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
                  disabled={isEditingLockedSuperAdmin}
                >
                  {USER_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {isEditingLockedSuperAdmin ? <span className="table-subtle">SUPER_ADMIN role is locked.</span> : null}
              </label>
              {isSuperAdmin && editForm.role === ROLES.ADMIN ? (
                <div className="field-stack users-edit-section">
                  <span>Manageable Roles</span>
                  <div className="mini-list users-manageable-list">
                    {USER_ROLE_OPTIONS.map((role) => (
                      <label key={role} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editManageableRoles.includes(role)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setEditManageableRoles((current) => {
                              if (checked) return Array.from(new Set([...current, role]));
                              return current.filter((value) => value !== role);
                            });
                          }}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {isSuperAdmin ? (
              <div className="users-edit-perm-field">
                <button
                  type="button"
                  className="users-edit-perm-accordion-trigger"
                  aria-expanded={isPermissionsOpen}
                  onClick={() => setIsPermissionsOpen((open) => !open)}
                >
                  <span className="users-edit-perm-accordion-title">Permissions</span>
                  <span className={`users-edit-perm-accordion-arrow${isPermissionsOpen ? " is-open" : ""}`} aria-hidden>
                    &gt;
                  </span>
                </button>
                {isPermissionsOpen ? (
                  <div className="users-edit-perm-content">
                    <EditPermissionSections
                      selectedPermissions={editPermissions}
                      onTogglePermission={toggleEditPermission}
                      onToggleAll={toggleEditAllPermissions}
                    />
                  </div>
                ) : null}
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

      {deviceViewerUser ? (
        <UserAssignedAssetsModal
          currentUser={currentUser}
          targetUser={deviceViewerUser}
          onClose={() => setDeviceViewerUser(null)}
        />
      ) : null}
    </div>
  );
}
