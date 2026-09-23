/**
 * SAMADHAN Authentication Compatibility Layer
 *
 * Authentication is handled by Clerk.
 *
 * This file intentionally does NOT:
 * - store passwords
 * - create frontend sessions
 * - generate fake authentication tokens
 * - determine admin access from an environment password
 *
 * Clerk is the source of truth for authentication and authorization.
 */

export type UserRole = 'admin' | 'passenger';

export interface AuthUser {
  id: string;
  name: string;
  identifier: string;
  role: UserRole;
  sessionToken: string;
  loginTime: string;
}

/**
 * Legacy compatibility object.
 *
 * New code should use:
 *   useAuth() from ../context/AuthContext
 *
 * and Clerk's useAuth/useUser hooks.
 */
export const authService = {
  /**
   * Authentication is now handled by Clerk.
   *
   * This method is intentionally unsupported so that old code
   * does not accidentally reintroduce the previous demo login.
   */
  login: async (): Promise<{
    success: false;
    error: string;
  }> => {
    return {
      success: false,
      error: 'Authentication is handled by Clerk.',
    };
  },

  /**
   * Clerk owns the active session.
   */
  logout: (): void => {
    // Intentionally empty.
    // Use Clerk's signOut() through useClerk().
  },

  /**
   * Clerk owns the current user.
   */
  getCurrentUser: (): AuthUser | null => {
    return null;
  },

  /**
   * Clerk owns authentication state.
   */
  isAuthenticated: (): boolean => {
    return false;
  },

  /**
   * Admin authorization is determined by Clerk public metadata.
   *
   * The actual check is performed in AuthContext:
   * user.publicMetadata.role === 'admin'
   */
  isAdmin: (): boolean => {
    return false;
  },

  /**
   * Passenger authorization is also determined by Clerk.
   */
  isPassenger: (): boolean => {
    return false;
  },
};