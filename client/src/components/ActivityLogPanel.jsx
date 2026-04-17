export function ActivityLogPanel({ items = [], title = "Activity Log", emptyText = "No recent actions yet." }) {
  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <strong>{title}</strong>
        <span className="table-subtle">Last {items.length} actions</span>
      </div>
      <div className="activity-log-body">
        {items.length ? (
          <div className="activity-log-list">
            {items.map((item) => (
              <div key={item.id} className={`activity-log-item ${item.status === "failed" ? "is-failed" : "is-success"}`}>
                <div className="activity-log-main">
                  <span className="activity-log-label">{item.label}</span>
                  <span className="activity-log-time">{new Date(item.at).toLocaleTimeString()}</span>
                </div>
                {item.detail ? <div className="activity-log-detail">{item.detail}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="table-subtle">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

