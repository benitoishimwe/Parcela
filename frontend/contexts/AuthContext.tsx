import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../utils/api';
import { storage } from '../utils/storage';

export interface User {
  user_id: string;
  name: string;
  phone?: string;
  email?: string;
  role: 'user' | 'courier' | 'admin';
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (name: string, phone: string, email: string, password: string) => Promise<void>;
  googleLogin: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handled = useRef(false);

  useEffect(() => { initAuth(); }, []);

  const initAuth = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=') && !handled.current) {
        handled.current = true;
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          try {
            window.history.replaceState(null, '', window.location.pathname);
            const result = await api.post('/api/auth/google/callback', { session_id: sessionId });
            await storage.set('parcela_token', result.token);
            setToken(result.token);
            setUser(result.user);
          } catch (err) {
            console.error('Google auth error:', err);
          } finally {
            setLoading(false);
          }
          return;
        }
      }
    }
    await checkStoredToken();
  };

  const checkStoredToken = async () => {
    try {
      const t = await storage.get('parcela_token');
      if (t) {
        const userData = await api.get('/api/auth/me', t);
        setToken(t);
        setUser(userData);
      }
    } catch {
      await storage.delete('parcela_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    const result = await api.post('/api/auth/login', { identifier, password });
    await storage.set('parcela_token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const signup = async (name: string, phone: string, email: string, password: string) => {
    const result = await api.post('/api/auth/signup', { name, phone, email: email || undefined, password });
    await storage.set('parcela_token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const googleLogin = async (sessionId: string) => {
    const result = await api.post('/api/auth/google/callback', { session_id: sessionId });
    await storage.set('parcela_token', result.token);
    setToken(result.token);
    setUser(result.user);
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout', {}, token || undefined); } catch {}
    await storage.delete('parcela_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
