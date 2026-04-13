import { useEffect, useMemo, useState } from "react";
import { getDashboardSummary } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";

const PAGE_SIZE = 10;

export function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getDashboardSummary()
      .then((data) => {
        setLogs(Array.isArray(data?.recentLogs) ? data.recentLogs : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter((log) => {
      const byName = log.performedBy
        ? `${log.performedBy.firstName || ""} ${log.performedBy.lastName || ""}`.toLowerCase()
        : "";
      const haystack = `${log.assetCode || ""} ${log.action || ""} ${byName}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  if (loading) return <div className="page-message">Loading logs...</div>;
  if (error) return <div className="page-message error">{error}</div>;

  return (
    <div className="page-stack">
      <SectionCard
        title="Logs"
        subtitle="Search and review audit entries"
        actions={
          <input
            className="input"
            placeholder="Search by asset, action, or user"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Action</th>
                <th>By</th>
                <th>At</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length ? (
                paginatedLogs.map((log) => (
                  <tr key={log._id}>
                    <td>{log.assetCode || "-"}</td>
                    <td>{log.action || "-"}</td>
                    <td>
                      {log.performedBy
                        ? `${log.performedBy.firstName || ""} ${log.performedBy.lastName || ""}`.trim()
                        : "Unknown"}
                    </td>
                    <td>{log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt).toLocaleString() : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="button dark" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
            Previous
          </button>
          <span className="table-subtle">
            Page {safePage} of {totalPages}
          </span>
          <button className="button dark" type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
            Next
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
