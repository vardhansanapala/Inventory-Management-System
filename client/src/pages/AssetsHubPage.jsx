import { Link } from "react-router-dom";

const hubCards = [
  {
    title: "Device Registry",
    description: "Browse and search existing devices.",
    to: "/assets?tab=registry",
  },
  {
    title: "Add Device",
    description: "Create a new device record.",
    to: "/assets?tab=add",
  },
  {
    title: "Categories",
    description: "Manage setup categories and masters.",
    to: "/setup",
  },
  {
    title: "Logs",
    description: "Review recent asset activity and history.",
    to: "/assets/logs",
  },
  {
    title: "Assign Device",
    description: "Run assignment and action workflows.",
    to: "/assets?tab=assign",
  },
];

export function AssetsHubPage() {
  return (
    <div className="assets-hub-wrap">
      <section className="section-card assets-hub">
        <div className="section-card-header">
          <div>
            <h2>Assets Hub</h2>
            <p>Select where you want to go in asset operations.</p>
          </div>
        </div>

        <div className="assets-hub-grid">
          {hubCards.map((card) => (
            <Link key={card.title} to={card.to} className="assets-hub-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
