import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MODULE_KEYS } from "./constants/permissions";
import { AssetsPage } from "./pages/AssetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LogsPage } from "./pages/LogsPage";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { DeviceInfoPage } from "./pages/DeviceInfoPage";
import { AssignDevicePage } from "./pages/AssignDevicePage";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="page-message">Loading auth...</div>;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.DASHBOARD}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.ASSETS}>
              <AssetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assign-device"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.ASSETS}>
              <AssignDevicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.LOGS}>
              <LogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.SETUP}>
              <SetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.USERS}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-info"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.DEVICE_INFO}>
              <DeviceInfoPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </AppShell>
  );
}
