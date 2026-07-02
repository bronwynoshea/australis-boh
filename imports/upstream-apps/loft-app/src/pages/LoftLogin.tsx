import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { authCookieStorage } from '@/services/authCookieStorage';
import { AUTH_STORAGE_KEY, supabase } from '@/services/supabaseClient';

const LoftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <>
    <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
    <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
  </>
);

type StatusVariant = 'info' | 'error' | 'success';

const isStaleStoredSessionError = (message?: string) => {
  const normalized = (message || '').toLowerCase();
  return (
    normalized.includes('refresh token') ||
    normalized.includes('invalid refresh') ||
    normalized.includes('rate limit')
  );
};

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getOtpSendErrorMessage = (message?: string) => {
  const normalized = (message || '').toLowerCase();
  if (
    normalized.includes('signups not allowed') ||
    normalized.includes('invalid email') ||
    normalized.includes('email address is invalid')
  ) {
    return 'Email not recognised. Check the address and try again.';
  }

  return message || 'Failed to send verification code.';
};

const LoftLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<{ variant: StatusVariant; text: string } | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const getPostLoginTarget = useCallback(() => {
    let target = '/lobby';
    try {
      const stored = sessionStorage.getItem('loft_post_login_redirect');
      if (stored && stored.startsWith('/')) {
        target = stored;
      }
      sessionStorage.removeItem('loft_post_login_redirect');
    } catch {
      // ignore storage issues
    }
    return target;
  }, []);

  const redirectIntoLoft = useCallback(() => {
    const target = getPostLoginTarget();
    window.location.hash = target;
  }, [getPostLoginTarget]);

  const reloadIntoLoft = useCallback(() => {
    const target = getPostLoginTarget();
    window.location.hash = target;
    window.setTimeout(() => window.location.reload(), 50);
  }, [getPostLoginTarget]);

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      setIsCheckingSession(true);
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      setIsCheckingSession(false);
      if (error) {
        if (isStaleStoredSessionError(error.message)) {
          authCookieStorage.removeItem(AUTH_STORAGE_KEY);
          setStatus(null);
          return;
        }
        setStatus({ variant: 'error', text: error.message || 'Unable to check session.' });
        return;
      }

      if (data?.session?.user?.id) {
        redirectIntoLoft();
      }
    };

    checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, [redirectIntoLoft]);

  const handleSendCode = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus({ variant: 'error', text: 'Enter an email address to continue.' });
      return;
    }
    if (!isValidEmailAddress(trimmedEmail)) {
      setStatus({ variant: 'error', text: 'Email not valid. Check the address and try again.' });
      return;
    }

    setIsSending(true);
    setStatus({ variant: 'info', text: 'Sending verification code...' });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      setCodeSent(true);
      setStatus({ variant: 'success', text: 'Enter the verification code we emailed you.' });
    } catch (err: any) {
      setStatus({ variant: 'error', text: getOtpSendErrorMessage(err?.message) });
    } finally {
      setIsSending(false);
    }
  }, [email]);

  const handleVerifyCode = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setStatus({ variant: 'error', text: 'Enter both email and verification code.' });
      return;
    }

    setIsVerifying(true);
    setStatus({ variant: 'info', text: 'Verifying code...' });
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedCode,
        type: 'email',
      });
      if (error) throw error;

      setStatus({ variant: 'success', text: 'Access confirmed. Redirecting...' });
      reloadIntoLoft();
      return;
    } catch (err: any) {
      setStatus({ variant: 'error', text: err?.message || 'Verification failed. Check the code and try again.' });
    }
    setIsVerifying(false);
  }, [code, email, reloadIntoLoft]);

  const stepTwoDisabled = useMemo(() => !codeSent || isSending, [codeSent, isSending]);

  const statusTone =
    status?.variant === 'error'
      ? 'text-red-500'
      : status?.variant === 'success'
      ? 'text-cafe'
      : 'text-muted';

  return (
    <div className="min-h-screen w-full bg-[var(--loft-bg)] text-main relative overflow-x-hidden">
      <img
        src="/loft_screens/2.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-25 dark:opacity-28 lg:hidden loft-cinematic-image"
      />
      <div className="absolute inset-0 loft-cinematic-grade lg:hidden" />
      <div className="absolute inset-0 bg-[var(--loft-bg)]/82 dark:bg-[#10163a]/82 lg:hidden" />
      <div className="absolute inset-0 opacity-70 dark:opacity-45 pointer-events-none">
        <div className="absolute -top-28 -left-24 w-80 h-80 rounded-full bg-cafe/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[34rem] h-[34rem] rounded-full bg-[#12b8d7]/15 blur-3xl" />
      </div>

      <main className="relative z-10 min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[minmax(380px,1.08fr)_minmax(0,0.92fr)]">
        <aside className="hidden lg:block sticky top-0 h-screen overflow-hidden">
          <img
            src="/loft_screens/2.png"
            alt="Loft workspace preview"
            className="absolute inset-0 w-full h-full object-cover loft-cinematic-image"
          />
          <div className="absolute inset-0 loft-cinematic-grade" />
          <div className="absolute inset-0 loft-cinematic-grade-soft" />
          <div className="absolute left-8 right-8 bottom-8 rounded-[2rem] bg-black/40 border border-white/15 p-6 text-white backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/55">For members</p>
            <p className="mt-3 text-3xl font-black tracking-tight">Manage the table before the session starts.</p>
          </div>
        </aside>

        <section className="flex flex-col px-5 py-5 md:px-8 md:py-6 xl:px-10 xl:py-8 min-h-screen lg:h-screen lg:min-h-0 overflow-y-auto no-scrollbar">
          <header className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '/join';
              }}
              className="flex items-center gap-3"
              aria-label="Loft home"
            >
              <LoftIcon className="w-10 h-10" />
              <span className="text-2xl font-black tracking-tight text-cafe uppercase">Loft</span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.hash = '/join';
              }}
              className="rounded-full border border-[var(--loft-border)] bg-[var(--loft-surface)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-main hover:text-cafe transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to join screen
            </button>
          </header>

          <div className="flex-1 flex items-center py-8 lg:py-5 xl:py-8">
            <div className="w-full max-w-xl space-y-5 xl:space-y-7">
              <div className="space-y-3 xl:space-y-4">
                <h1 className="text-4xl md:text-5xl xl:text-6xl font-black tracking-tight leading-[0.95] text-main">
                  Member access for Loft hosts and teams.
                </h1>
                <p className="text-sm md:text-base leading-relaxed text-muted max-w-lg">
                  Sign in to manage your profile, personal table, scheduled tables, and live sessions.
                </p>
              </div>

              <div className="loft-card p-4 md:p-5 xl:p-6 space-y-4 xl:space-y-5 lg:min-h-[520px]">
                <div className={`min-h-4 text-center text-[11px] uppercase tracking-[0.35em] ${isCheckingSession ? 'text-muted' : 'text-transparent'}`}>
                  {isCheckingSession ? 'Checking session...' : 'Ready'}
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted">Step 1</p>
                  <label className="text-xs font-black uppercase tracking-[0.28em] text-main">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="loft-input w-full rounded-2xl px-5 py-3.5 text-sm font-medium text-main placeholder:text-muted bg-[var(--loft-surface)]"
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSending}
                    className="w-full rounded-2xl bg-cafe text-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.25em] hover:brightness-110 disabled:opacity-60 active:scale-95 transition-all"
                  >
                    {isSending ? 'Sending...' : codeSent ? 'Resend code' : 'Send code'}
                  </button>
                </div>

                <div className={`space-y-3 ${stepTwoDisabled ? 'opacity-55 pointer-events-none' : ''}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted">Step 2</p>
                  <label className="text-xs font-black uppercase tracking-[0.28em] text-main">
                    Verification code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="6-digit code"
                    className="loft-input w-full rounded-2xl px-5 py-3.5 text-sm font-medium text-main placeholder:text-muted bg-[var(--loft-surface)]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={stepTwoDisabled || isVerifying}
                    className="w-full rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-main px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.25em] hover:bg-[var(--loft-surface)] disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify and enter'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div
                  aria-live="polite"
                  className={`min-h-8 text-center text-[11px] font-black uppercase tracking-[0.25em] ${status ? statusTone : 'text-transparent'}`}
                >
                  {status?.text || 'No message'}
                </div>
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">
                A JOBZCAFE® product
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default LoftLogin;
