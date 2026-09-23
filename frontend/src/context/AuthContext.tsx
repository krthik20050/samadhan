import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import {
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from '@clerk/react-router';
import { setTokenGetter } from '../lib/api/client';

export type UserRole = 'admin' | 'passenger';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPassenger: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Clerk's authentication/session state
  const {
    isLoaded: isAuthLoaded,
    isSignedIn,
    getToken,
  } = useClerkAuth();

  React.useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Clerk's current User object
  const {
    isLoaded: isUserLoaded,
    user: clerkUser,
  } = useUser();

  const { signOut } = useClerk();

  const isLoading = !isAuthLoaded || !isUserLoaded;

  const role: UserRole =
    clerkUser?.publicMetadata?.role === 'admin'
      ? 'admin'
      : 'passenger';

  const isAuthenticated =
    isAuthLoaded && Boolean(isSignedIn);

  const user: AuthUser | null =
    isAuthenticated && clerkUser
      ? {
          id: clerkUser.id,
          email:
            clerkUser.primaryEmailAddress?.emailAddress ?? null,
          name:
            [clerkUser.firstName, clerkUser.lastName]
              .filter(Boolean)
              .join(' ') || null,
          role,
        }
      : null;

  const logout = async () => {
    await signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin: isAuthenticated && role === 'admin',
        isPassenger:
          isAuthenticated && role === 'passenger',
        isLoading,
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
    throw new Error(
      'useAuth must be used within an AuthProvider',
    );
  }

  return context;
};