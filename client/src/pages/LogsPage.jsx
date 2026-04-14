import { useEffect, useMemo, useState } from "react";
import { listLogs } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";

const ALL_ACTIONS = "ALL_ACTIONS";
const ALL_TYPES = "ALL_TYPES";

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState(ALL_ACTIONS);
  const [logType, setLogType] = useState(ALL_TYPES);

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");
      const data = await listLogs({
        search,
        actionType: actionType === ALL_ACTIONS ? "" : actionType,
        logType: logType === ALL_TYPES ? "" : logType,
      });
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [search, actionType, logType]);

  const actionOptions = useMemo(() => {
    const actionSet = new Set(logs.map((log) => log.actionType).filter(Boolean));
    return [ALL_ACTIONS, ...Array.from(actionSet).sort()];
  }, [logs]);

  if (loading) {
    return <div className="page-message">Loading logs...</div>;
  }

  if (error) {
    return <div className="page-message error">{error}</div>;
  }

  return (
    <div className="page-stack">
      <SectionCard
        title="Logs"
        subtitle="Review asset activity and user-management audit events from one place."
        actions={
          <div className="logs-toolbar">
            <input
              className="input"
              placeholder="Search by action, asset, actor, or target user"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="input" value={logType} onChange={(event) => setLogType(event.target.value)}>
              <option value={ALL_TYPES}>All log types</option>
              <option value="ASSET">Asset events</option>
              <option value="USER">User events</option>
            </select>
            <select className="input" value={actionType} onChange={(event) => setActionType(event.target.value)}>
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === ALL_ACTIONS ? "All actions" : option}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Action</th>
                <th>Target</th>
                <th>By</th>
                <th>At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length ? (
                logs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <span className={`log-type-badge ${log.logType === "USER" ? "is-user" : "is-asset"}`}>
                        {log.logType}
                      </span>
                    </td>
                    <td>{log.actionType || "-"}</td>
                    <td>
                      {log.logType === "USER"
                        ? log.targetUser
                          ? `${log.targetUser.firstName || ""} ${log.targetUser.lastName || ""}`.trim()
                          : "Unknown user"
                        : log.assetCode || "-"}
                    </td>
                    <td>
                      {log.performedBy
                        ? `${log.performedBy.firstName || ""} ${log.performedBy.lastName || ""}`.trim()
                        : "Unknown"}
                    </td>
                    <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No logs found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
