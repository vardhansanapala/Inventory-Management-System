import { Link } from "react-router-dom";
import { useMemo } from "react";
import { MODULE_KEYS, PERMISSIONS, canAccessModule, hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

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
  const { user } = useAuth();

  const visibleCards = useMemo(() => {
    return hubCards.filter((card) => {
      if (card.to.includes("tab=add")) {
        return hasPermission(user, PERMISSIONS.CREATE_ASSET);
      }

      if (card.to.includes("tab=assign")) {
        return hasPermission(user, PERMISSIONS.ASSIGN_ASSET) || hasPermission(user, PERMISSIONS.UPDATE_ASSET);
      }

      if (card.to === "/setup") {
        return canAccessModule(user, MODULE_KEYS.SETUP);
      }

      return true;
    });
  }, [user]);

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
          {visibleCards.map((card) => (
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
