import { useEffect, useMemo, useState } from "react";
import { createUser } from "../../api/inventory";
import { ActionFeedback } from "../ActionFeedback";
import { PERMISSIONS, ROLE_DEFAULTS, hasPermission } from "../../constants/permissions";
import { ROLES } from "../../constants/roles";
import { useAuth } from "../../context/AuthContext";
import { useActionFeedback } from "../../hooks/useActionFeedback";

export const USER_STATUSES = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
};

export const USER_ROLE_OPTIONS = [ROLES.ADMIN, ROLES.EMPLOYEE];

export const USER_ROLE_FILTER_OPTIONS = [
  { label: "ALL", value: "ALL" },
  { label: ROLES.ADMIN, value: ROLES.ADMIN },
  { label: ROLES.EMPLOYEE, value: ROLES.EMPLOYEE },
  { label: ROLES.SUPER_ADMIN, value: ROLES.SUPER_ADMIN },
];

export const emptyCreateForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: ROLES.EMPLOYEE,
  status: USER_STATUSES.ACTIVE,
  password: "",
  confirmPassword: "",
};

export const emptyPasswordForm = {
  password: "",
  confirmPassword: "",
};

export const emptyEditForm = {
  firstName: "",
  lastName: "",
  role: ROLES.EMPLOYEE,
  status: USER_STATUSES.ACTIVE,
};

const PERMISSION_GROUPS = [
  {
    title: "User",
    subtitle: "Account lifecycle and credential access",
    permissions: [PERMISSIONS.CREATE_USER, PERMISSIONS.EDIT_USER, PERMISSIONS.DELETE_USER, PERMISSIONS.RESET_PASSWORD],
  },
  {
    title: "Asset",
    subtitle: "Registry, updates, and assignments",
    permissions: [PERMISSIONS.CREATE_ASSET, PERMISSIONS.UPDATE_ASSET, PERMISSIONS.DELETE_ASSET, PERMISSIONS.ASSIGN_ASSET],
  },
  {
    title: "Product",
    subtitle: "SKU and catalog management",
    permissions: [PERMISSIONS.CREATE_PRODUCT, PERMISSIONS.EDIT_PRODUCT, PERMISSIONS.DELETE_PRODUCT],
  },
];

const ALL_PERMISSIONS = Array.from(new Set(PERMISSION_GROUPS.flatMap((group) => group.permissions)));

export function getPasswordErrors(password, confirmPassword) {
  const errors = {};

  if (password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  if (confirmPassword && password !== confirmPassword) {
    errors.confirmPassword = "Passwords must match.";
  }

  return errors;
}

export function generateStrongPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const length = 12;
  return Array.from({ length }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
}

export function formatTimestamp(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
}

function getSortableTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortUsersByUpdatedAtDesc(users) {
  return [...users].sort((left, right) => {
    return getSortableTimestamp(right?.updatedAt) - getSortableTimestamp(left?.updatedAt);
  });
}

export function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  placeholder = "Add at least 6 characters",
  autoComplete = "new-password",
}) {
  return (
    <label className="field-stack">
      {label ? <span>{label}</span> : null}
      <div className="password-field">
        <input
          className="input"
          type={visible ? "text" : "password"}
          placeholder={placeholder}
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

export function PermissionGroupGrid({
  selectedPermissions,
  onTogglePermission,
  onToggleAll,
}) {
  const allSelected = ALL_PERMISSIONS.every((permission) => selectedPermissions.includes(permission));

  return (
    <>
      <div className="inline-form">
        <button className="button ghost" type="button" onClick={onToggleAll}>
          {allSelected ? "Unselect All" : "Select All"}
        </button>
      </div>
      <div className="users-permission-grid">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title} className="users-permission-box">
            <div className="users-permission-box-title">{group.title}</div>
            <div className="table-subtle">{group.subtitle}</div>
            <div className="users-permission-checks">
              {group.permissions.map((permission) => (
                <label key={permission} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission)}
                    onChange={(event) => onTogglePermission(permission, event.target.checked)}
                  />
                  {permission}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function EditPermissionSections({ selectedPermissions, onTogglePermission, onToggleAll }) {
  const allSelected = ALL_PERMISSIONS.every((permission) => selectedPermissions.includes(permission));

  return (
    <div className="users-edit-perm-panel">
      <div className="inline-form users-edit-perm-toolbar">
        <button className="button ghost" type="button" onClick={onToggleAll}>
          {allSelected ? "Unselect All" : "Select All"}
        </button>
      </div>
      <div className="users-edit-perm-scroll">
        {PERMISSION_GROUPS.map((group) => (
          <section key={group.title} className="users-edit-perm-group" aria-label={group.title}>
            <h3 className="users-edit-perm-group-title">{group.title.toUpperCase()}</h3>
            <div className="users-edit-perm-checks">
              {group.permissions.map((permission) => (
                <label key={permission} className="checkbox-label users-edit-perm-check">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(permission)}
                    onChange={(event) => onTogglePermission(permission, event.target.checked)}
                  />
                  {permission}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function UserCreateForm({ onCreated }) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;
  const canCreateUser = hasPermission(currentUser, PERMISSIONS.CREATE_USER);
  const createFeedback = useActionFeedback({ preferGlobal: true });
  const [busyKey, setBusyKey] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [createManageableRoles, setCreateManageableRoles] = useState([]);
  const [createPermissions, setCreatePermissions] = useState([]);

  const createPasswordErrors = getPasswordErrors(createForm.password, createForm.confirmPassword);
  const createFormValid = useMemo(() => {
    return (
      Boolean(createForm.firstName.trim()) &&
      Boolean(createForm.lastName.trim()) &&
      Boolean(createForm.email.trim()) &&
      createForm.password.length >= 6 &&
      createForm.password === createForm.confirmPassword
    );
  }, [createForm]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const defaults = ROLE_DEFAULTS[createForm.role]?.permissions || [];
    setCreatePermissions((current) => (current.length ? current : defaults));
  }, [createForm.role, isSuperAdmin]);

  function setCreateRole(nextRole) {
    setCreateForm((current) => ({ ...current, role: nextRole }));

    if (nextRole === ROLES.ADMIN) {
      setCreateManageableRoles([ROLES.EMPLOYEE]);
    } else {
      setCreateManageableRoles([]);
    }

    if (isSuperAdmin) {
      setCreatePermissions(ROLE_DEFAULTS[nextRole]?.permissions || []);
    }
  }

  function toggleCreatePermission(permission, checked) {
    setCreatePermissions((current) => {
      if (checked) return Array.from(new Set([...current, permission]));
      return current.filter((value) => value !== permission);
    });
  }

  function toggleCreateAllPermissions() {
    setCreatePermissions((current) => {
      const allSelected = ALL_PERMISSIONS.every((permission) => current.includes(permission));
      return allSelected ? [] : ALL_PERMISSIONS.slice();
    });
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

  function resetCreateState() {
    setCreateForm(emptyCreateForm);
    setShowCreatePassword(false);
    setShowCreateConfirm(false);
    setCreateManageableRoles([]);
    setCreatePermissions([]);
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!createFormValid) {
      return;
    }

    setBusyKey("create-user");

    const result = await createFeedback.handleAsyncAction(
      () =>
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
      {
        loadingMsg: "Creating user...",
        successMsg: "User created successfully.",
        errorMsg: "Unable to create user.",
        globalSuccess: true,
        globalError: true,
      }
    );

    setBusyKey("");

    if (result) {
      resetCreateState();
      onCreated?.(result);
    }
  }

  if (!canCreateUser) {
    return <div className="page-message">You do not have permission to create users.</div>;
  }

  return (
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
              <select className="input" value={createForm.role} onChange={(event) => setCreateRole(event.target.value)}>
                {USER_ROLE_OPTIONS.map((role) => (
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
                {USER_ROLE_OPTIONS.map((role) => {
                  const isEnabled = createManageableRoles.includes(role);

                  return (
                    <button
                      key={role}
                      className={isEnabled ? "users-pill is-on" : "users-pill"}
                      type="button"
                      onClick={() => {
                        setCreateManageableRoles((current) => {
                          if (current.includes(role)) return current.filter((value) => value !== role);
                          return Array.from(new Set([...current, role]));
                        });
                      }}
                    >
                      <span className="users-pill-label">{role}</span>
                      <span className="users-pill-mark">{isEnabled ? "OK" : "+"}</span>
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
              <PermissionGroupGrid
                selectedPermissions={createPermissions}
                onTogglePermission={toggleCreatePermission}
                onToggleAll={toggleCreateAllPermissions}
              />
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
  );
}
