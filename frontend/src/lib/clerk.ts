/**
 * Clerk configuration for the frontend.
 *
 * One value does everything (Google/social sign-in included):
 *   VITE_CLERK_PUBLISHABLE_KEY  e.g. pk_test_a2V5... or pk_live_...
 *
 * Until it is set, the app still runs: passengers file complaints
 * anonymously and depot staff sign in with the shared staff token.
 */
export const CLERK_PUBLISHABLE_KEY = (
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ''
).trim();

export const clerkEnabled = CLERK_PUBLISHABLE_KEY.length > 0;

/** True while the real keys are not wired yet (demo/bootstrapping). */
export const clerkPlaceholder = CLERK_PUBLISHABLE_KEY.startsWith('pk_test_PASTE');

/** Which social providers the Clerk instance offers (shown on the login card). */
export const SOCIAL_PROVIDERS = ['Google', 'Email code'] as const;
