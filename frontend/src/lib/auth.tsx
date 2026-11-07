import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, SessionUser, setAccessToken, setSessionHandlers } from './api';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: SessionUser };

interface AuthContextValue {
  state: AuthState;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  setUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const queryClient = useQueryClient();

  const setUser = useCallback((user: SessionUser) => setState({ status: 'authenticated', user }), []);

  useEffect(() => {
    setSessionHandlers({
      onSession: setUser,
      onExpired: () => {
        setAccessToken(null);
        queryClient.clear();
        setState({ status: 'anonymous', user: null });
      },
    });
    // Au chargement : reprise de session grâce au cookie httpOnly, s'il existe.
    void refreshSession().then((ok) => {
      if (!ok) setState({ status: 'anonymous', user: null });
    });
  }, [queryClient, setUser]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.post<{ accessToken: string; user: SessionUser }>('/auth/login', { username, password });
      setAccessToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'anonymous', user: null });
  }, [queryClient]);

  const value = useMemo(() => ({ state, login, logout, setUser }), [state, login, logout, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors de AuthProvider');
  return ctx;
}

/** Utilisateur connecté (à n'utiliser que sous une route protégée). */
export function useUser(): SessionUser {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('Utilisateur non connecté');
  return state.user;
}
