import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessModule } from "../constants/permissions";

export function ProtectedRoute({ moduleKey, allowedRoles = [], children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  const bypassModuleCheck = location.pathname.startsWith("/scan");

  if (loading) {
    return <div className="page-message">Loading access...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  if (bypassModuleCheck) {
    return children;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (moduleKey && !canAccessModule(user, moduleKey)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
