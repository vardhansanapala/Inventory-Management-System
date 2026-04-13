import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/assets", label: "Assets" },
    { to: "/logs", label: "Logs" },
    { to: "/setup", label: "Setup" },
  ];
  if (user?.role === 'SUPER_ADMIN') {
    links.push({ to: "/users", label: "Users" });
  }
  return (
    <div className="layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Office Ops</p>
          <h1>Inventory Command Center</h1>
          <p className="sidebar-copy">
            Track assets, audit every movement, and keep setup masters clean.
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
              <button className="button" onClick={logout}>Logout</button>
            </>
          ) : (
            <NavLink to="/login" className="button">Login</NavLink>
          )}
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}

