import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Employee, UserRole } from '../types';
import { api } from '../services/api';
import { toast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  employeeProfile: Employee | null;
  permissions: string[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role?: UserRole, userId?: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  changePassword: (newPassword: string, confirmPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decode JWT expiry without any extra library — pure base64 */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.exp ? decoded.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('review_app_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Schedule a silent token refresh 2 minutes before access token expiry */
  const scheduleRefresh = (currentToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const expiry = getTokenExpiry(currentToken);
    if (!expiry) return;

    const now = Date.now();
    const refreshAt = expiry - 2 * 60 * 1000; // 2 minutes before expiry
    const delay = Math.max(refreshAt - now, 30 * 1000); // at least 30s or when due

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.refreshToken();
        if (data.token) {
          localStorage.setItem('review_app_token', data.token);
          setToken(data.token);
          scheduleRefresh(data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('review_app_refresh_token', data.refreshToken);
        }
        setUser(data.user);
        setEmployeeProfile(data.employeeProfile || null);
        setPermissions(data.permissions || []);
      } catch {
        // Refresh failed — user session may have been revoked; clear session cleanly
        localStorage.removeItem('review_app_token');
        localStorage.removeItem('review_app_refresh_token');
        setToken(null);
        setUser(null);
        setEmployeeProfile(null);
        setPermissions([]);
        toast.warning('Your session has expired or was revoked. Please sign in again.', 'Session expired');
      }
    }, delay);
  };

  const loadSession = async () => {
    setIsLoading(true);
    const storedToken = localStorage.getItem('review_app_token');
    if (!storedToken) {
      setUser(null);
      setEmployeeProfile(null);
      setPermissions([]);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      setEmployeeProfile(data.employeeProfile || null);
      setPermissions(data.permissions || []);
      scheduleRefresh(storedToken);
    } catch (err) {
      console.warn('Invalid token, resetting session...');
      localStorage.removeItem('review_app_token');
      setToken(null);
      setUser(null);
      setEmployeeProfile(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();

    const handleSessionExpired = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      setToken(null);
      setUser(null);
      setEmployeeProfile(null);
      setPermissions([]);
      toast.warning('Your session has expired or was revoked. Please sign in again.', 'Session expired');
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.login(email, password);
      // Clear any GET responses cached under the previous identity — the cache key is
      // URL-only, so without this a stale, differently-scoped response (e.g. another
      // user's employee list) can be served for up to its TTL after switching accounts.
      api.clearCache();
      localStorage.setItem('review_app_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setEmployeeProfile(data.employeeProfile || null);
      setPermissions(data.permissions || []);
      scheduleRefresh(data.token);
      toast.success(`Welcome back, ${data.user.name}!`, 'Signed in successfully');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please verify your credentials.', 'Authentication failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (role?: UserRole, userId?: string) => {
    setIsLoading(true);
    try {
      const data = await api.switchRole(role, userId);
      api.clearCache();
      localStorage.setItem('review_app_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setEmployeeProfile(data.employeeProfile || null);
      setPermissions(data.permissions || []);
      scheduleRefresh(data.token);
      toast.info(`Switched persona to ${data.user.role} (${data.user.name})`, 'Persona active');
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch role.', 'Role switch error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      await api.logout().catch(() => {});
      api.clearCache();
      localStorage.removeItem('review_app_token');
      setUser(null);
      setEmployeeProfile(null);
      setPermissions([]);
      setToken(null);
      // Cleanly clear previous view hash so next logged in persona lands on their own default workspace
      window.location.hash = '';
      toast.info('You have logged out successfully.', 'Session closed');
    } catch (err: any) {
      toast.error(err.message || 'Logout encountered an issue.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (newPassword: string, confirmPassword: string) => {
    const data = await api.changePassword(newPassword, confirmPassword);
    // Update the token and user state so mustChangePassword is cleared
    localStorage.setItem('review_app_token', data.token);
    setToken(data.token);
    setUser(data.user);
    scheduleRefresh(data.token);
    toast.success('Password updated successfully. Welcome!', 'Password changed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        employeeProfile,
        permissions,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchRole,
        refreshSession: loadSession,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
