import { NavLink } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { getVisibleSidebarLinks } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const links = getVisibleSidebarLinks(user);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Office Ops</p>
          <h1>Inventory Command Center</h1>
          <p className="sidebar-copy">
            Track assets, audit every movement, and manage access with role-aware controls.
          </p>
        </div>

        <nav className="nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="header">
        <div className="header-content">
          {user ? (
            <>
              <span className="user-badge">
                {user.firstName} {user.lastName} · {String(user.role || "").replaceAll("_", " ")}
              </span>
              <div className="header-actions">
                <ThemeToggle />
                <button className="button" onClick={logout}>
                  Logout
                </button>
              </div>
            </>
          ) : (
            <NavLink to="/login" className="button">
              Login
            </NavLink>
          )}
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}
