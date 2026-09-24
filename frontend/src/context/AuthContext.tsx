import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/react';
import { clerkEnabled } from '../lib/clerk';
import { staffSession } from '../lib/auth';
import type { UserRole } from '../lib/auth';
import { setAuthTokenProvider } from '../lib/api/client';

export interface AuthUser {
  id: string;
  name: string;
  email?: string | null;
  role: UserRole;
  source: 'clerk' | 'staff';
}

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

const API_BASE = (
  import.meta.env.VITE_API_URL ??
  'https://ikipstqlumypppfypdrx.supabase.co/functions/v1/api'
).replace(/\/+$/, '');

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ponytail: clerk hooks require <ClerkProvider>; clerkEnabled gates demo mode.
  const clerk = clerkEnabled ? useClerkAuth() : null;
  const clerkUser = clerkEnabled ? useClerkUser() : null;

  const [staff, setStaff] = useState(staffSession.get);

  // Feed the Clerk session token to the API client (staff token is the
  // client's own fallback when no Clerk session exists).
  const clerkGetToken = clerk?.getToken;
  useEffect(() => {
    if (!clerkEnabled || !clerkGetToken) return;
    setAuthTokenProvider(async () => {
      try {
        return await clerkGetToken();
      } catch {
        return null;
      }
    });
  }, [clerkGetToken]);

  const user: AuthUser | null = useMemo(() => {
    if (staff) {
      return { id: 'staff', name: staff.name, role: 'admin', source: 'staff' };
    }
    if (clerkEnabled && clerk?.isSignedIn && clerkUser?.user) {
      const u = clerkUser.user;
      const name =
        u.fullName || u.username || u.primaryEmailAddress?.emailAddress || 'Passenger';
      const metaRole = (u.publicMetadata as { role?: string } | null | undefined)?.role;
      return {
        id: u.id,
        name,
        email: u.primaryEmailAddress?.emailAddress ?? null,
        role: metaRole === 'admin' ? 'admin' : 'passenger',
        source: 'clerk',
      };
    }
    return null;
  }, [staff, clerk?.isSignedIn, clerkUser?.user]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const trimmedPass = password.trim();
      if (!identifier.trim()) {
        return { success: false as const, error: 'Please enter your name or identifier.' };
      }
      if (!trimmedPass || trimmedPass.length < 4) {
        return { success: false as const, error: 'Please enter a valid password (minimum 4 characters).' };
      }
      // The server is the only source of the admin role.
      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: trimmedPass }),
        });
        if (res.ok) {
          const name = identifier.trim().toLowerCase() === 'admin'
            ? 'Depot Operations Officer'
            : identifier.trim();
          staffSession.save(name, trimmedPass);
          setStaff(staffSession.get());
          return { success: true as const, role: 'admin' as UserRole };
        }
        return { success: false as const, error: 'Incorrect staff credentials.' };
      } catch {
        return {
          success: false as const,
          error: 'The backend is unavailable. Please try again when the service is online.',
        };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    if (staff) {
      staffSession.clear();
      setStaff(null);
      return;
    }
    if (clerkEnabled && clerk?.isSignedIn) {
      void clerk.signOut();
    }
  }, [staff, clerk]);

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isPassenger: user?.role === 'passenger',
    isLoading: clerkEnabled ? !clerk?.isLoaded : false,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
