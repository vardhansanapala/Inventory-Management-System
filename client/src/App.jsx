import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getSetupBootstrap } from "./api/inventory";
import { AppShell } from "./components/AppShell";
import { AssetsPage } from "./pages/AssetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LogsPage } from "./pages/LogsPage";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { ScanPage } from "./pages/ScanPage";
import { UsersPage } from "./pages/UsersPage";
import { useAuth } from "./context/AuthContext";

const emptySetupData = {
  categories: [],
  products: [],
  locations: [],
  users: [],
};

export default function App() {
  const [setupData, setSetupData] = useState(emptySetupData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const refreshSetupData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setSetupData(emptySetupData);
      setError("");
      setLoading(false);
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H1", location: "App.jsx:35", message: "refreshSetupData skipped (no user)", data: { authLoading, hasUser: false }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      return;
    }

    setLoading(true);
    try {
      setError("");
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H1", location: "App.jsx:29", message: "refreshSetupData start", data: { hasUser: Boolean(user), authLoading }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      const data = await getSetupBootstrap();
      setSetupData(data);
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H1", location: "App.jsx:33", message: "refreshSetupData success", data: { categoriesCount: Array.isArray(data?.categories) ? data.categories.length : -1 }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
    } catch (err) {
      setError(err.message);
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H1", location: "App.jsx:38", message: "refreshSetupData failed", data: { errorMessage: err.message }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    refreshSetupData();
  }, [refreshSetupData]);

  useEffect(() => {
    const overlay = document.querySelector(".modal-overlay");
    const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;
    const centerX = Math.floor(window.innerWidth / 2);
    const centerY = Math.floor(window.innerHeight / 2);
    const topCenterElement = document.elementFromPoint(centerX, centerY);
    const topCenterStyle = topCenterElement ? window.getComputedStyle(topCenterElement) : null;
    // #region agent log
    fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "post-fix", hypothesisId: "H5", location: "App.jsx:49", message: "ui overlay snapshot", data: { path: location.pathname, viewport: `${window.innerWidth}x${window.innerHeight}`, hasModalOverlay: Boolean(overlay), overlayDisplay: overlayStyle?.display || null, overlayZIndex: overlayStyle?.zIndex || null, centerTag: topCenterElement?.tagName || null, centerClass: topCenterElement?.className || null, centerId: topCenterElement?.id || null, centerPosition: topCenterStyle?.position || null, centerZIndex: topCenterStyle?.zIndex || null, centerPointerEvents: topCenterStyle?.pointerEvents || null, centerOpacity: topCenterStyle?.opacity || null, centerBackdrop: topCenterStyle?.backdropFilter || null, hasUser: Boolean(user), authLoading }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
  }, [authLoading, location.pathname, user]);

  if (authLoading) return <div className="page-message">Loading auth...</div>;

  const isAuthenticated = Boolean(user);

  return (
    <AppShell>
      {isAuthenticated && loading ? <div className="page-message">Loading website...</div> : null}
      {isAuthenticated && error ? <div className="page-message error">{error}</div> : null}

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/scan/:assetId" element={<ScanPage />} />
        <Route path="/" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/assets"
          element={isAuthenticated ? <AssetsPage setupData={setupData} refreshSetupData={refreshSetupData} /> : <Navigate to="/login" replace />}
        />
        <Route path="/logs" element={isAuthenticated ? <LogsPage /> : <Navigate to="/login" replace />} />
        <Route
          path="/setup"
          element={isAuthenticated ? <SetupPage setupData={setupData} refreshSetupData={refreshSetupData} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/users"
          element={
            isAuthenticated && user?.role === 'SUPER_ADMIN' ? (
              <UsersPage setupData={setupData} refreshSetupData={refreshSetupData} />
            ) : (
              <Navigate to={isAuthenticated ? "/" : "/login"} replace />
            )
          }
        />
        <Route path="*" element={!isAuthenticated ? <Navigate to="/login" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
