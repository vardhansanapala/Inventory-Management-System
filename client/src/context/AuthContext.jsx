import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login, getCurrentUser } from '../api/inventory';
import { setAuthToken, getAuthToken, clearAuthToken } from '../api/authStorage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCurrentUser = useCallback(async () => {
    try {
      setError('');
      const token = getAuthToken();
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H2", location: "AuthContext.jsx:18", message: "fetchCurrentUser entry", data: { hasToken: Boolean(token) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      if (!token) {
        setUser(null);
        return;
      }
      const currentUser = await getCurrentUser();
      setUser(currentUser?.user || null);
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "post-fix", hypothesisId: "H2", location: "AuthContext.jsx:27", message: "fetchCurrentUser success", data: { role: currentUser?.user?.role || null, payloadHasUserKey: Boolean(currentUser?.user) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
    } catch (err) {
      clearAuthToken();
      setUser(null);
      setError(err.message);
      // #region agent log
      fetch("http://127.0.0.1:7299/ingest/afc6bc82-97a6-4cba-b47f-6786dfde5c37", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "37ac0c" }, body: JSON.stringify({ sessionId: "37ac0c", runId: "pre-fix", hypothesisId: "H2", location: "AuthContext.jsx:34", message: "fetchCurrentUser failed", data: { errorMessage: err.message }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email, password) => {
    try {
      setError('');
      const response = await login({ email, password });
      setAuthToken(response.token);
      setUser(response.user);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setError('');
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login: handleLogin, logout: handleLogout, refetchUser: fetchCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

