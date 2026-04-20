export function StatusPill({ status }) {
  const normalized = String(status || "");
  const token = normalized.toLowerCase();
  const semantic =
    token === "available" ||
    token === "assigned" ||
    token === "in_use" ||
    token === "outside" ||
    token === "sent_out" ||
    token === "rented_out" ||
    token === "under_repair" ||
    token === "reserved"
      ? "primary"
      : token === "sold" || token === "retired"
        ? "success"
        : token === "lost"
          ? "danger"
          : "warning";

  return <span className={`status-pill status-${token} status-${semantic}`}>{normalized || "-"}</span>;
}
