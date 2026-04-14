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
      if (!token) {
        setUser(null);
        return;
      }
      const currentUser = await getCurrentUser();
      setUser(currentUser?.user || null);
    } catch (err) {
      clearAuthToken();
      setUser(null);
      setError(err.message);
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

