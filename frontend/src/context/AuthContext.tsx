import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../lib/auth';
import type { AuthUser, UserRole } from '../lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPassenger: boolean;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [isLoading] = useState(false);

  const login = async (identifier: string, password: string) => {
    const res = await authService.login(identifier, password);
    if (res.success && res.user) {
      setUser(res.user);
      return { success: true, role: res.role };
    }
    return { success: false, error: res.error || 'Authentication failed' };
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAdmin: Boolean(user && user.role === 'admin'),
        isPassenger: Boolean(user && user.role === 'passenger'),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
