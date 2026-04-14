export function ActionButton({ label, title, onClick, danger = false, disabled = false, icon }) {
  return (
    <button
      type="button"
      className={`action-icon-button ${danger ? "danger" : ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title || label}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

