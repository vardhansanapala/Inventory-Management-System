import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  helperText = "",
  placeholder = "Use at least 8 characters with atleast one uppercase letter, one lowercase letter, one number, and one special character.",
  autoComplete = "new-password",
  disabled = false,
  id,
  name,
}) {
  const baseId = id || name || "password-field";
  const describedBy = [
    helperText ? `${baseId}-help` : "",
    error ? `${baseId}-error` : "",
  ].filter(Boolean).join(" ");

  return (
    <label className="field-stack">
      {label ? <span>{label}</span> : null}
      <div className="password-input-shell">
        <input
          id={baseId}
          name={name}
          className="input password-input"
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
        />
        <button
          className="password-visibility-toggle"
          type="button"
          onClick={onToggle}
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {helperText ? <p id={`${baseId}-help`} className="field-hint">{helperText}</p> : null}
      {error ? <p id={`${baseId}-error`} className="field-error">{error}</p> : null}
    </label>
  );
}
