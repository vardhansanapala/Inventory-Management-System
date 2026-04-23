import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardSummary } from "../api/inventory";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { isVisibleAssetStatus } from "../constants/assetWorkflow";

export function DashboardPage() {
  const navigate = useNavigate();
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
        <StatCard label="Total Assets : " value={summary.totalAssets} onClick={() => navigate("/assets")} />
        {/* <StatCard label="In Repairs : " value={summary.openRepairs} accent="forest" onClick={() => navigate("/assets?status=UNDER_REPAIR")} /> */}
        <StatCard label="Available : " value={summary.statusBreakdown.AVAILABLE || 0} accent="sun" onClick={() => navigate("/assets?status=AVAILABLE")} />
        <StatCard label="Assigned : " value={summary.statusBreakdown.ASSIGNED || 0} accent="ink" onClick={() => navigate("/assets?status=ASSIGNED")} />
        {/* <StatCard label="Rented Out : " value={summary.statusBreakdown.RENTED_OUT || 0} accent="ink" onClick={() => navigate("/assets?status=RENTED_OUT")} /> */}
        {/* <StatCard label="Damaged : " value={summary.statusBreakdown.DAMAGED || 0} accent="forest" onClick={() => navigate("/assets?status=DAMAGED")} /> */}
        {/* <StatCard label="Sold : " value={summary.statusBreakdown.SOLD || 0} accent="success" onClick={() => navigate("/assets?status=SOLD")} /> */}
        {/* <StatCard label="Lost : " value={summary.statusBreakdown.LOST || 0} accent="danger" onClick={() => navigate("/assets?status=LOST")} /> */}
      </div>

      <SectionCard title="Status Breakdown" subtitle="Current status counts across all assets">
        <div className="status-grid">
          {Object.entries(summary.statusBreakdown)
            .filter(([status]) => isVisibleAssetStatus(status))
            .map(([status, count]) => (
            <div key={status} className="status-row status-row-clickable" role="button" tabIndex={0} onClick={() => navigate(`/assets?status=${encodeURIComponent(status)}`)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/assets?status=${encodeURIComponent(status)}`);
              }
            }}>
              <StatusPill status={status} />
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* <SectionCard title="Recent Audit Activity" subtitle="Latest inventory movement trail">
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
      </SectionCard> */}
    </div>
  );
}
