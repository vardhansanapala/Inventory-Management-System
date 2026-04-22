import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MODULE_KEYS } from "./constants/permissions";
import { AssetsPage } from "./pages/AssetsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LogsPage } from "./pages/LogsPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { UserCreatePage } from "./pages/UserCreatePage";
import { SetupPage } from "./components/setup/SetupShared";
import { SetupCategoriesPage } from "./pages/SetupCategoriesPage";
import { SetupCategoryCreatePage } from "./pages/SetupCategoryCreatePage";
import { SetupLocationsPage } from "./pages/SetupLocationsPage";
import { SetupLocationCreatePage } from "./pages/SetupLocationCreatePage";
import { SetupProductsPage } from "./pages/SetupProductsPage";
import { SetupProductCreatePage } from "./pages/SetupProductCreatePage";
import { DeviceInfoPage } from "./pages/DeviceInfoPage";
import { DevicesPage } from "./pages/DevicesPage";
import { EmployeeDeviceInfoPage } from "./pages/EmployeeDeviceInfoPage";
import { AssignDevicePage } from "./pages/AssignDevicePage";
import { ScanRedirectPage } from "./pages/ScanRedirectPage";
import { useAuth } from "./context/AuthContext";
import { ROLES } from "./constants/roles";

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
          path="/devices"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.DEVICES}>
              <DevicesPage />
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
        >
          <Route index element={<Navigate to={user?.role === ROLES.SUPER_ADMIN ? "/setup/categories" : "/setup/products"} replace />} />
          <Route path="categories" element={<SetupCategoriesPage />} />
          <Route path="categories/create" element={<SetupCategoryCreatePage />} />
          <Route path="locations" element={<SetupLocationsPage />} />
          <Route path="locations/create" element={<SetupLocationCreatePage />} />
          <Route path="products" element={<SetupProductsPage />} />
          <Route path="products/create" element={<SetupProductCreatePage />} />
        </Route>
        <Route
          path="/users"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.USERS}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/create"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.USERS}>
              <UserCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-info"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.DEVICE_INFO}>
              {user?.role === ROLES.SUPER_ADMIN ? <DeviceInfoPage /> : <EmployeeDeviceInfoPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/device-info/:assetId"
          element={
            <ProtectedRoute moduleKey={MODULE_KEYS.DEVICE_INFO}>
              {user?.role === ROLES.SUPER_ADMIN ? <DeviceInfoPage /> : <EmployeeDeviceInfoPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan/:qrCode"
          element={
            <ProtectedRoute>
              <ScanRedirectPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </AppShell>
  );
}
