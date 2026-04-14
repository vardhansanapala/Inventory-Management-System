export function FormInput({ label, error, className = "", ...props }) {
  return (
    <label className={`field-stack ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <input className="input" {...props} />
      {error ? <p className="field-error">{error}</p> : null}
    </label>
  );
}

export function FormTextarea({ label, error, className = "", ...props }) {
  return (
    <label className={`field-stack ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <textarea className="input textarea" {...props} />
      {error ? <p className="field-error">{error}</p> : null}
    </label>
  );
}

