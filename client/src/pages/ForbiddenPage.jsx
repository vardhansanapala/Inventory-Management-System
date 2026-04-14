import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <div className="page-stack forbidden-page">
      <section className="section-card forbidden-card">
        <p className="eyebrow">403</p>
        <h2>Access denied</h2>
        <p>You do not have permission to open this module with your current role.</p>
        <Link className="button" to="/">
          Back to dashboard
        </Link>
      </section>
    </div>
  );
}
