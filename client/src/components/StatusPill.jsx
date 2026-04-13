export function StatusPill({ status }) {
  return <span className={`status-pill status-${String(status).toLowerCase()}`}>{status}</span>;
}

