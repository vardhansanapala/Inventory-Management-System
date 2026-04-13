export function SectionCard({ title, subtitle, children, actions = null }) {
  return (
    <section className="section-card">
      <div className="section-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

