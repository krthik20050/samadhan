import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useSignIn, useUser } from '@clerk/react-router';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  Lock,
  Mail,
  ArrowLeft,
  Building2,
  AlertCircle,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { signIn, fetchStatus, errors } = useSignIn();
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const isSubmitting = fetchStatus === 'fetching';

  const destination =
    (location.state as { from?: string } | null)?.from ||
    '/admin/depot';

  // Already signed in
  React.useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !user) {
      return;
    }

    const role = user.publicMetadata?.role;

    if (role === 'admin') {
      navigate(destination, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [
    isUserLoaded,
    isSignedIn,
    user,
    navigate,
    destination,
  ]);

  const finalizeSignIn = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setError(
            'Additional account setup is required before continuing.',
          );
          return;
        }

        const url = decorateUrl(destination);

        if (url.startsWith('http')) {
          window.location.href = url;
        } else {
          navigate(url, { replace: true });
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    try {
      const { error: signInError } = await signIn.password({
        emailAddress: identifier.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message ||
            'Incorrect credentials. Please check your email and password.',
        );
        return;
      }

      if (signIn.status === 'complete') {
        await finalizeSignIn();
        return;
      }

      if (signIn.status === 'needs_client_trust') {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor) => factor.strategy === 'email_code',
        );

        if (!emailCodeFactor) {
          setError(
            'This account requires additional verification, but no email verification method is available.',
          );
          return;
        }

        const { error: codeError } =
          await signIn.mfa.sendEmailCode();

        if (codeError) {
          setError(
            codeError.message ||
              'Unable to send the verification code.',
          );
          return;
        }

        setVerificationSent(true);
        return;
      }

      if (signIn.status === 'needs_second_factor') {
        setError(
          'This account has multi-factor authentication enabled. Please complete the configured second-factor method.',
        );
        return;
      }

      setError(
        'Sign-in could not be completed. Please try again.',
      );
    } catch (err) {
      console.error('Clerk sign-in error:', err);

      setError(
        'Unable to sign in right now. Please try again.',
      );
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (!code.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    try {
      const { error: verifyError } =
        await signIn.mfa.verifyEmailCode({
          code: code.trim(),
        });

      if (verifyError) {
        setError(
          verifyError.message ||
            'Invalid verification code. Please try again.',
        );
        return;
      }

      if (signIn.status === 'complete') {
        await finalizeSignIn();
        return;
      }

      setError(
        'Verification was accepted, but sign-in is not complete yet.',
      );
    } catch (err) {
      console.error('Clerk verification error:', err);

      setError(
        'Unable to verify the code. Please try again.',
      );
    }
  };

  const resendCode = async () => {
    setError(null);

    try {
      const { error: resendError } =
        await signIn.mfa.sendEmailCode();

      if (resendError) {
        setError(
          resendError.message ||
            'Unable to resend the verification code.',
        );
        return;
      }

      setVerificationSent(true);
    } catch (err) {
      console.error('Clerk resend error:', err);

      setError(
        'Unable to resend the verification code.',
      );
    }
  };

  const startOver = () => {
    signIn.reset();
    setIdentifier('');
    setPassword('');
    setCode('');
    setError(null);
    setVerificationSent(false);
  };

  React.useEffect(() => {
    if (errors?.fields?.identifier?.message) {
      setError(errors.fields.identifier.message);
    } else if (errors?.fields?.password?.message) {
      setError(errors.fields.password.message);
    } else if (errors?.fields?.code?.message) {
      setError(errors.fields.code.message);
    }
  }, [errors]);

  const showVerification =
    verificationSent ||
    signIn.status === 'needs_client_trust';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">

      {/* Top Bar */}
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
                  DEPOT
                </span>
              </div>

              <h1 className="text-base font-bold text-[var(--text-primary)]">
                {showVerification
                  ? 'Verify your account'
                  : 'Depot Operations'}
              </h1>

              <p className="text-xs text-[var(--text-secondary)] font-normal leading-relaxed">
                {showVerification
                  ? 'We sent a verification code to your email to confirm this device.'
                  : 'Restricted access for authorised depot staff.'}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] flex items-start gap-2 text-[var(--semantic-error)] text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {!showVerification ? (
            /* ---------------- LOGIN FORM ---------------- */
            <form onSubmit={handleSubmit} className="space-y-4">

              <Input
                label="Email"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={identifier}
                onChange={(e) =>
                  setIdentifier(e.target.value)
                }
                leftIcon={
                  <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                }
                required
              />

              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                leftIcon={
                  <Lock className="w-4 h-4 text-[var(--text-muted)]" />
                }
                required
              />

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
          ) : (
            /* ---------------- VERIFICATION FORM ---------------- */
            <form onSubmit={handleVerify} className="space-y-4">

              <Input
                label="Verification code"
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter the code from your email"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value)
                }
                required
              />

              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isSubmitting}
                >
                  Verify & Continue
                </Button>

                <button
                  type="button"
                  onClick={resendCode}
                  disabled={isSubmitting}
                  className="w-full text-sm font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                >
                  Send a new code
                </button>

                <button
                  type="button"
                  onClick={startOver}
                  disabled={isSubmitting}
                  className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Start over
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-[var(--text-muted)] font-mono space-y-0.5">
        <p>SAMADHAN Grievance & Escalation Platform</p>
        <p>Your Voice. A Better Journey.</p>
      </div>
    </div>
  );
};