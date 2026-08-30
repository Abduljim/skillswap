import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, Me, setToken } from './api';

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (me: Me | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  me: null,
  loading: true,
  refresh: async () => {},
  setMe: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: Me }>('/auth/me');
      setMe(data.user);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setToken(null);
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, refresh, setMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
