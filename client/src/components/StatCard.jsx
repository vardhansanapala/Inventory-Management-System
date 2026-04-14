export function StatCard({ label, value, accent = "warm", onClick }) {
  const isInteractive = typeof onClick === "function";

  return (
    <div
      className={isInteractive ? `stat-card is-clickable accent-${accent}` : `stat-card accent-${accent}`}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

