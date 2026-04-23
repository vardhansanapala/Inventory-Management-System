import { getDisplayAssetStatus } from "../constants/assetWorkflow";

export function StatusPill({ status }) {
  const normalized = getDisplayAssetStatus(status);
  const token = normalized === "-" ? "unknown" : normalized.toLowerCase();
  const semantic =
    token === "available" ||
    token === "assigned" ||
    token === "rented_out" ||
    token === "under_repair"
      ? "primary"
      : token === "sold"
        ? "success"
        : token === "lost"
          ? "danger"
          : "warning";

  return <span className={`status-pill status-${token} status-${semantic}`}>{normalized || "-"}</span>;
}
