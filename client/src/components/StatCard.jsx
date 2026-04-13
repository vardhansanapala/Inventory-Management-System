export function StatCard({ label, value, accent = "warm" }) {
  return (
    <div className={`stat-card accent-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

