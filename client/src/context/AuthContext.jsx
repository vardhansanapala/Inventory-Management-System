import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login, getCurrentUser } from '../api/inventory';
import { setAuthToken, getAuthToken, clearAuthToken } from '../api/authStorage';

const AuthContext = createContext();

function toAuthError(error) {
  if (error?.code === "APP_UNINITIALIZED") {
    return {
      code: "APP_UNINITIALIZED",
      message: "Inventory setup is incomplete. Ask a server administrator to enable bootstrap and create the Super Admin account.",
    };
  }

  if (error?.code === "SERVER_UNAVAILABLE" || error?.status === 0) {
    return {
      code: "SERVER_UNAVAILABLE",
      message: "Server unavailable. Check that the API is running and try again.",
    };
  }

  if (error?.status === 401) {
    return {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    };
  }

  return {
    code: error?.code || "AUTH_FAILED",
    message: error?.message || "Authentication failed.",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setError('');
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const currentUser = await getCurrentUser();
      setUser(currentUser?.user || null);
    } catch (err) {
      const parsedError = toAuthError(err);
      clearAuthToken();
      setUser(null);
      setError(parsedError.message);
      setAuthError(parsedError);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (email, password) => {
    try {
      setError('');
      setAuthError(null);
      const response = await login({ email, password });
      setAuthToken(response.token);
      setUser(response.user);
      return { success: true };
    } catch (err) {
      const parsedError = toAuthError(err);
      setError(parsedError.message);
      setAuthError(parsedError);
      return { success: false, error: parsedError.message, code: parsedError.code };
    }
  };

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setError('');
    setAuthError(null);
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, authError, login: handleLogin, logout: handleLogout, refetchUser: fetchCurrentUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

