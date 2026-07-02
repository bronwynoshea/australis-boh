import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

const LoftDevLogin: React.FC = () => {
  const enabledState = useMemo(() => {
    const env = (import.meta as any)?.env;
    const flag = String(env?.VITE_ENABLE_LOFT_LOGIN ?? '')
      .trim()
      .toLowerCase();
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const isEnabled = !!(env?.DEV || flag === 'true' || isLocalhost);
    try {
      if (env?.DEV) {
        // Removed console.debug statement
      }
    } catch {
      // ignore
    }
    return { enabled: isEnabled, usedFallback: !env?.DEV && flag !== 'true' && isLocalhost };
  }, []);
  const enabled = enabledState.enabled;
  const usedFallback = enabledState.usedFallback;

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<'info' | 'error' | 'success'>('info');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setMessage(error.message);
      }
      setIsLoggedIn(!!data?.session);
      setSessionEmail(data?.session?.user?.email || null);
      setIsChecking(false);
    });
    return () => {
      isMounted = false;
    };
  }, [enabled]);

  const handleSend = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessageVariant('error');
      setMessage('Please enter an email address.');
      return;
    }
    setSendStatus('sending');
    setMessage(null);
    setMessageVariant('info');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSendStatus('sent');
      setCodeSent(true);
      setMessageVariant('info');
      setMessage('Enter the verification code we emailed you.');
    } catch (err: any) {
      setSendStatus('error');
      setMessageVariant('error');
      setMessage(err?.message || 'Failed to send verification code.');
    }
  }, [email]);

  const handleVerify = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setMessageVariant('error');
      setMessage('Enter both email and verification code.');
      return;
    }
    setIsVerifying(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedCode,
        type: 'email',
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      setIsLoggedIn(!!data?.session);
      setSessionEmail(data?.session?.user?.email || trimmedEmail);
      setMessageVariant('success');
      setMessage('Verification successful. You can now access Loft.');
    } catch (err: any) {
      setMessageVariant('error');
      setMessage(err?.message || 'Verification failed. Check the code and try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [email, code]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setSessionEmail(null);
    setSendStatus('idle');
    setCodeSent(false);
    setCode('');
    setMessage(null);
  }, []);

  const handleGoToRooms = useCallback(() => {
    window.location.hash = '/lobby';
  }, []);

  if (!enabled) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white/5 dark:bg-black/30 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-4 text-white/70 text-sm leading-relaxed">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/50">Loft Dev Login</p>
            <h1 className="mt-3 text-2xl font-black text-white">Standalone Magic Link</h1>
          </div>
          <p>Dev login is disabled in this environment.</p>
          <p className="text-xs uppercase tracking-[0.3em] font-bold">Set VITE_ENABLE_LOFT_LOGIN=true and restart Vite to use this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white/5 dark:bg-black/30 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/50">Loft Dev Login</p>
          <h1 className="mt-3 text-2xl font-black text-white">Standalone Magic Link</h1>
        </div>
        {usedFallback && (
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-amber-300">
            Running on localhost, forcing dev login on. Set VITE_ENABLE_LOFT_LOGIN=true to enable explicitly.
          </div>
        )}
        <div className="space-y-4">
          {isChecking ? (
            <div className="text-white/60 text-sm">Checking session…</div>
          ) : (
            <>
              <div className="text-white/80 text-sm">
                {isLoggedIn
                  ? `You're logged in${sessionEmail ? ` as ${sessionEmail}` : ''}.`
                  : 'No Supabase session detected.'}
              </div>
              {isLoggedIn && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleGoToRooms}
                    className="w-full rounded-2xl bg-cafe text-white font-bold py-3 uppercase tracking-widest"
                  >
                    Go to rooms
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-2xl border border-white/20 text-white font-bold py-3 uppercase tracking-widest"
                  >
                    Log out
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-cafe"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sendStatus === 'sending'}
            className="w-full rounded-2xl bg-cafe text-white font-bold py-3 uppercase tracking-widest disabled:opacity-50"
          >
            {sendStatus === 'sending' ? 'Sending code…' : 'Send verification code'}
          </button>
          <label className="block text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Verification code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-cafe"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={!codeSent || isVerifying}
            className="w-full rounded-2xl bg-white/10 border border-white/30 text-white font-bold py-3 uppercase tracking-widest disabled:opacity-40"
          >
            {isVerifying ? 'Verifying…' : 'Verify & Sign in'}
          </button>
          {message && (
            <div
              className={`text-xs font-bold uppercase tracking-[0.3em] ${
                messageVariant === 'error'
                  ? 'text-red-300'
                  : messageVariant === 'success'
                  ? 'text-green-400'
                  : 'text-white/60'
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoftDevLogin;
