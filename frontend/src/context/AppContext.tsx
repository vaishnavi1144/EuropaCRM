import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { FieldConfig } from '@/types';
import { api, AuthUser, getAuthToken, setAuthToken } from '@/lib/api';
import { effectivePermissions, firstAllowedPath, normalizeRole } from '@/lib/permissions';

export type UserRole = 'Super Admin' | 'SALES' | 'RECRUITER' | 'BENCHSALES' | 'AITEAM';

type AppContextType = {
  activeRole: UserRole;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  googleLogin: (credential: string, rememberMe?: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  firstAllowedPath: string;
  customFields: Record<string, FieldConfig[]>;
  addCustomField: (resource: string, field: FieldConfig) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function roleFromUser(role?: string): UserRole {
  switch (normalizeRole(role)) {
    case 'SUPER_ADMIN': return 'Super Admin';
    case 'RECRUITER': return 'RECRUITER';
    case 'BENCHSALES': return 'BENCHSALES';
    case 'AITEAM': return 'AITEAM';
    default: return 'SALES';
  }
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [customFields, setCustomFields] = useState<Record<string, FieldConfig[]>>(() => {
    const saved = localStorage.getItem('europa_custom_fields');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const restore = async () => {
      if (!getAuthToken()) { setAuthLoading(false); return; }
      try {
        const response = await api.me();
        setCurrentUser(response.user);
      } catch {
        setAuthToken(null);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    void restore();
    const unauthorized = () => setCurrentUser(null);
    window.addEventListener('europa:unauthorized', unauthorized);
    return () => window.removeEventListener('europa:unauthorized', unauthorized);
  }, []);

  const login = async (username: string, password: string, rememberMe = true) => {
    const response = await api.login(username, password, rememberMe);
    setAuthToken(response.token);
    setCurrentUser(response.user);
    return response.user;
  };

  const googleLogin = async (credential: string, rememberMe = true) => {
    const response = await api.googleLogin(credential, rememberMe);
    setAuthToken(response.token);
    setCurrentUser(response.user);
    return response.user;
  };

  const logout = async () => {
    try { if (getAuthToken()) await api.logout(); } catch { /* clear locally regardless */ }
    setAuthToken(null);
    setCurrentUser(null);
  };

  const addCustomField = (resource: string, field: FieldConfig) => {
    setCustomFields((prev) => {
      const next = { ...prev };
      if (!next[resource]) next[resource] = [];
      if (next[resource].some((item) => item.key === field.key)) return prev;
      next[resource] = [...next[resource], field];
      localStorage.setItem('europa_custom_fields', JSON.stringify(next));
      return next;
    });
  };

  const allowed = effectivePermissions(currentUser?.role, currentUser?.permissions);
  const allowedSet = new Set(allowed);
  const value = useMemo<AppContextType>(() => ({
    activeRole: roleFromUser(currentUser?.role),
    currentUser,
    isAuthenticated: Boolean(currentUser),
    authLoading,
    login,
    googleLogin,
    logout,
    hasPermission: (permission: string) => currentUser?.role === 'SUPER_ADMIN' || allowedSet.has(permission),
    firstAllowedPath: firstAllowedPath(currentUser?.role, currentUser?.permissions),
    customFields,
    addCustomField,
  }), [currentUser, authLoading, customFields, allowed.join('|')]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppContextProvider');
  return context;
}
