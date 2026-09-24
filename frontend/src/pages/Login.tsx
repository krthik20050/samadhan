import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clerkEnabled } from '../lib/clerk';
import { SignInButton, SignUpButton } from '@clerk/react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  Lock,
  User,
  ArrowLeft,
  Building2,
  AlertCircle,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isAdmin } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'clerk' | 'staff'>(clerkEnabled ? 'clerk' : 'staff');

  const from = (location.state as { from?: string } | null)?.from;

  // If already signed in, route to the right portal.
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin/depot' : from && !from.startsWith('/admin') ? from : '/', { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate, from]);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your name or operational identifier.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter the depot password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(identifier, password);
      if (result.success && result.role === 'admin') {
        navigate(from && from.startsWith('/admin') ? from : '/admin/depot', { replace: true });
      } else {
        setError(result.error || 'Incorrect credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar / Passenger return */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Passenger Experience</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-[var(--surface-primary)] rounded-[14px] border border-[var(--border-standard)] p-6 sm:p-8 space-y-6 text-left">
          {/* Header */}
          <div className="text-center space-y-2.5">
            <div className="w-10 h-10 rounded-[8px] bg-[var(--brand)] text-[var(--accent)] flex items-center justify-center mx-auto">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                  SAMADHAN
                </span>
                <span className="text-[10px] font-mono font-bold text-[var(--brand)] bg-[var(--surface-secondary)] border border-[var(--border-standard)] px-1.5 py-0.2 rounded">
                  ACCESS
                </span>
              </div>
              <h1 className="text-base font-bold text-[var(--text-primary)]">
                {mode === 'clerk' ? 'Passenger Sign In' : 'Depot Operations'}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-normal leading-relaxed">
                {mode === 'clerk'
                  ? 'Sign in to keep your complaints, reference IDs and trips in one account.'
                  : 'Restricted access for authorised depot staff.'}
              </p>
            </div>
          </div>

          {/* Passenger: Clerk (Google / email code) */}
          {mode === 'clerk' && clerkEnabled ? (
            <div className="space-y-3">
              <SignInButton fallbackRedirectUrl={from && !from.startsWith('/admin') ? from : '/account'}>
                <Button variant="primary" size="lg" fullWidth icon={<LogIn className="w-4 h-4" />}>
                  Sign in with Google or Email
                </Button>
              </SignInButton>
              <SignUpButton fallbackRedirectUrl="/account">
                <Button variant="secondary" size="lg" fullWidth icon={<UserPlus className="w-4 h-4" />}>
                  Create passenger account
                </Button>
              </SignUpButton>
            </div>
          ) : (
            /* Staff fallback form */
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] flex items-start gap-2 text-[var(--semantic-error)] text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <div>
                <Input
                  label="Name"
                  id="name"
                  name="name"
                  autoComplete="username"
                  placeholder="Enter your name or ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  leftIcon={<User className="w-4 h-4 text-[var(--text-muted)]" />}
                  required
                />
              </div>

              <div>
                <Input
                  label="Password"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-[var(--text-muted)]" />}
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isSubmitting}
                >
                  Sign In
                </Button>
              </div>
            </form>
          )}

          {/* Mode switch */}
          <div className="pt-1 border-t border-[var(--border-standard)] flex items-center justify-between text-[12px]">
            {mode === 'clerk' ? (
              <button
                type="button"
                onClick={() => { setMode('staff'); setError(null); }}
                className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Depot staff sign in
              </button>
            ) : clerkEnabled ? (
              <button
                type="button"
                onClick={() => { setMode('clerk'); setError(null); }}
                className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
              >
                <LogIn className="w-3.5 h-3.5" />
                Passenger sign in
              </button>
            ) : (
              <span className="text-[var(--text-muted)]">
                Passenger accounts activate once the Clerk key is configured.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-[var(--text-muted)] font-mono space-y-0.5">
        <p>SAMADHAN Grievance &amp; Escalation Platform</p>
        <p>Your Voice. A Better Journey.</p>
      </div>
    </div>
  );
};
