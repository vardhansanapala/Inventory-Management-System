import { useEffect, useState } from "react";
import { getDashboardSummary } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";

export function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="page-message error">{error}</div>;
  }

  if (!summary) {
    return <div className="page-message">Loading dashboard...</div>;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <p className="eyebrow">Operational snapshot</p>
        <h2>Live visibility across devices, locations, and repair flow.</h2>
        <p>
          This website is the first phase of the platform. It is already wired for transactional
          asset actions, audit history, CSV imports, and future mobile sync.
        </p>
      </section>

      <div className="stats-grid">
        <StatCard label="Total Assets" value={summary.totalAssets} />
        <StatCard label="Open Repairs" value={summary.openRepairs} accent="forest" />
        <StatCard label="Available" value={summary.statusBreakdown.AVAILABLE || 0} accent="sun" />
        <StatCard label="Assigned" value={summary.statusBreakdown.ASSIGNED || 0} accent="ink" />
      </div>

      <SectionCard title="Status Breakdown" subtitle="Current status counts across all assets">
        <div className="status-grid">
          {Object.entries(summary.statusBreakdown).map(([status, count]) => (
            <div key={status} className="status-row">
              <StatusPill status={status} />
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Audit Activity" subtitle="Latest inventory movement trail">
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
              {summary.recentLogs.map((log) => (
                <tr key={log._id}>
                  <td>{log.assetCode}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.performedBy
                      ? `${log.performedBy.firstName} ${log.performedBy.lastName}`
                      : "Unknown"}
                  </td>
                  <td>{new Date(log.timestamp || log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
