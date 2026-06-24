import React, { useState, useEffect } from 'react';
import { Page } from '../App';
import AngledLogo from '../components/AngledLogo';
import IntegratedFooter from '../components/IntegratedFooter';
import { supabase } from '../services/supabaseClient';
import { supabaseDb } from '../services/supabaseDb';
import { invokeStaffFunction } from '../services/slotzFunctions';

interface HomePageProps {
    navigate: (page: Page) => void;
    setIsStaff: (isStaff: boolean) => void;
}

const bootstrapStaffProfile = async () => {
    const { data, error } = await invokeStaffFunction<{ profileId?: string; error?: string }>('slotz-bootstrap-staff');
    if (error || data?.error || !data?.profileId) {
        throw new Error(data?.error || error?.message || 'SLOTZ staff setup failed.');
    }
    return data.profileId;
};

const HomePage: React.FC<HomePageProps> = ({ navigate, setIsStaff }) => {
    const [loginStage, setLoginStage] = useState<'email' | 'code'>('email');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginCode, setLoginCode] = useState('');
    const [isProcessingAuth, setIsProcessingAuth] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    const [embeddedSessionError, setEmbeddedSessionError] = useState<string | null>(null);

    // Check for existing session on component mount
    useEffect(() => {
        const checkExistingSession = async () => {
            try {
                // Load saved email and timestamp from localStorage
                const savedEmail = localStorage.getItem('staffEmail');
                const savedTimestamp = localStorage.getItem('staffLoginTimestamp');
                
                if (savedEmail && savedTimestamp) {
                    const loginTime = parseInt(savedTimestamp);
                    const now = Date.now();
                    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
                    
                    // Check if session is still valid (within 30 days)
                    if (now - loginTime < thirtyDaysInMs) {
                        setLoginEmail(savedEmail);
                    } else {
                        // Session expired, clear localStorage
                        localStorage.removeItem('staffEmail');
                        localStorage.removeItem('staffLoginTimestamp');
                    }
                }

                // Check if user is already authenticated
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (session && !error) {
                    // User is already authenticated through BOH. Prefer an existing SLOTZ staff
                    // profile and only fall back to the bootstrap function if none exists yet.
                    const { data: profile, error: profileError } = await supabase
                        .from('scheduling_staff_profiles')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .maybeSingle();

                    if (profileError) {
                        throw profileError;
                    }

                    let staffProfileId = profile?.id ?? null;

                    if (!staffProfileId) {
                        staffProfileId = await bootstrapStaffProfile();
                    }

                    localStorage.setItem('staffEmail', session.user.email || '');
                    localStorage.setItem('staffLoginTimestamp', Date.now().toString());
                    supabaseDb.setCurrentStaff(staffProfileId);
                    setEmbeddedSessionError(null);
                    setIsStaff(true);
                    navigate('staff-dashboard');
                    return;
                }
            } catch (error) {
                console.error('Error checking session:', error);
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setEmbeddedSessionError(
                        error instanceof Error
                            ? error.message
                            : 'SLOTZ could not prepare your BOH staff workspace.'
                    );
                }
            } finally {
                setIsCheckingSession(false);
            }
        };

        checkExistingSession();
    }, [navigate, setIsStaff]);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessingAuth(true);
        setAuthMessage(null);
        
        // Save email and timestamp to localStorage (30-day persistence)
        localStorage.setItem('staffEmail', loginEmail.trim());
        localStorage.setItem('staffLoginTimestamp', Date.now().toString());
        
        const { error } = await supabase.auth.signInWithOtp({
            email: loginEmail.trim(),
            options: { shouldCreateUser: false },
        });
        
        if (error) {
            setAuthMessage(error.message || 'We could not send the sign-in code. Please try again.');
        } else {
            setLoginStage('code');
        }
        setIsProcessingAuth(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessingAuth(true);
        setAuthMessage(null);

        try {
            const trimmedEmail = loginEmail.trim().toLowerCase();
            const trimmedCode = loginCode.trim();

            const { data, error } = await supabase.auth.verifyOtp({
                email: trimmedEmail,
                token: trimmedCode,
                type: 'email',
            });

            if (error) {
                console.error('Verify code error:', error);
                const isNetworkError =
                    error.name === 'AuthRetryableFetchError' ||
                    error.message?.toLowerCase().includes('failed to fetch');
                setAuthMessage(
                    isNetworkError
                        ? 'Could not reach the verification service. Please check your connection and try again.'
                        : 'Invalid verification code. Please try again.'
                );
                setIsProcessingAuth(false);
            } else if (data.user) {
                // Check if user has staff profile
                const { data: profile, error: profileError } = await supabase
                    .from('scheduling_staff_profiles')
                    .select('id')
                    .eq('user_id', data.user.id)
                    .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                const staffProfileId = profile?.id ?? await bootstrapStaffProfile();

                // Success! Set the staff ID for database queries
                supabaseDb.setCurrentStaff(staffProfileId);

                setIsProcessingAuth(false);
                setIsStaff(true);
                navigate('staff-dashboard');
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            const message = err instanceof Error ? err.message : 'Verification failed. Please try again.';
            setAuthMessage(message);
            await supabase.auth.signOut();
            setIsProcessingAuth(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row animate-fade-in bg-[#151024] dark:bg-darkbg">
            {isCheckingSession ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-primary-text-muted">Checking session...</p>
                    </div>
                </div>
            ) : embeddedSessionError ? (
                <div className="flex-1 flex items-center justify-center bg-[#151024] p-6">
                    <div className="max-w-lg rounded-2xl border border-primary/25 bg-[#201936] p-6 text-center shadow-2xl shadow-black/30">
                        <AngledLogo size="sm" />
                        <h2 className="mt-4 text-2xl font-semibold text-white">SLOTZ workspace needs setup</h2>
                        <p className="mt-3 text-sm font-medium text-white/70">Your BOH session is active, but SLOTZ could not prepare the staff workspace.</p>
                        <p className="mt-3 rounded-xl border border-primary/20 bg-[#151024] p-3 text-xs text-white/70">{embeddedSessionError}</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="absolute inset-0 bg-darkbg overflow-hidden md:relative md:inset-auto md:flex md:flex-1 md:flex-col md:justify-end md:py-14 md:px-10 lg:px-14 md:min-h-screen">
                        <img
                            src="/slotz-login-hero-slots.png"
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover object-[48%_top] md:object-[38%_center]"
                        />
                        <div className="absolute inset-0 bg-[#151024]/24 md:bg-[#151024]/10" />
                        <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-[#151024]/48 via-[#151024]/14 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-[#151024]/92 via-[#151024]/76 to-transparent md:hidden" />
                        <div className="relative z-10 hidden w-full max-w-xl rounded-lg border border-primary/25 bg-[#201936]/68 px-5 py-5 shadow-2xl shadow-black/24 backdrop-blur-md md:block md:px-7 md:py-6">
                            <p className="max-w-lg text-sm md:text-base text-white font-medium leading-relaxed">
                                Professional scheduling, bookings, and calendar sync. Made simple.
                            </p>
                            <div className="mt-5 hidden md:flex items-center space-x-4">
                                <div className="h-px w-14 bg-[#8F7CFF]/55"></div>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">SECURE ACCESS</span>
                                <div className="h-px w-14 bg-[#8F7CFF]/55"></div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 overflow-hidden bg-transparent dark:bg-transparent flex min-h-screen flex-col px-4 pb-8 pt-[42vh] md:min-h-0 md:bg-white md:dark:bg-darkcard md:p-16 md:border-t-0 md:border-l border-primary-border dark:border-white/10 shadow-xl md:shadow-none">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#201936]/18 via-[#201936]/72 to-[#201936]/94 md:hidden" />
                        <div className="pointer-events-none absolute inset-0 hidden dark:md:block bg-[radial-gradient(circle_at_38%_24%,rgba(99,92,205,0.18),transparent_34%),linear-gradient(145deg,rgba(143,124,255,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_38%)]" />
                        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent md:block" />
                        <div className="relative z-10 flex-grow flex items-center justify-center">
                            <div className="w-full max-w-[420px] space-y-6 rounded-xl border border-[rgba(99,92,205,0.25)] bg-[rgba(32,25,54,0.68)] p-4 shadow-2xl shadow-black/24 backdrop-blur-[3px] md:max-w-[460px] md:space-y-8 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                                <div className="flex items-center justify-center gap-2 md:justify-start md:gap-3.5">
                                    <div className="relative top-[1px] flex items-center">
                                        <AngledLogo size="login" />
                                    </div>
                                    <h1 className="text-[2.9rem] font-semibold tracking-tight leading-[0.9] text-primary uppercase md:text-[3.75rem]">SLOTZ</h1>
                                </div>
                                <div className="space-y-1 text-center md:text-left">
                                    <h2 className="text-3xl font-semibold tracking-tight text-primary dark:text-white/95">Welcome back.</h2>
                                    <p className="text-sm text-primary-text-muted dark:text-white/70 font-medium">Please authenticate to continue.</p>
                                </div>
                                <form onSubmit={loginStage === 'email' ? handleSendCode : handleLogin} className="space-y-4 md:space-y-6">
                                    <div className="space-y-4 md:space-y-6">
                                        {authMessage && (
                                            <div role="alert" className="slotz-notice slotz-notice-error px-4 py-3 text-sm font-medium">
                                                {authMessage}
                                            </div>
                                        )}
                                        <div className="group">
                                            <label htmlFor="login-email" className="block text-[10px] font-medium uppercase tracking-[0.2em] mb-2 text-primary-text-muted dark:text-white/70 group-focus-within:text-[#BDB6FF] transition-colors">Email Address</label>
                                            <div className="relative">
                                                <input
                                                    id="login-email"
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="your@email.com"
                                                    value={loginEmail}
                                                    onChange={(e) => setLoginEmail(e.target.value)}
                                                    disabled={loginStage === 'code' || isProcessingAuth}
                                                    className="w-full appearance-none rounded-xl border border-primary-border bg-primary-light px-5 py-4 text-base font-normal text-[var(--text-secondary)] outline-none transition-all placeholder:text-primary-text-muted/80 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus-visible:outline-none active:border-primary/50 disabled:cursor-not-allowed disabled:border-[rgba(99,92,205,0.28)] disabled:bg-primary-light disabled:text-[var(--text-secondary)] dark:border-[rgba(99,92,205,0.28)] dark:bg-[#120D1F]/50 dark:text-white dark:placeholder:text-white/60 dark:focus:border-[rgba(99,92,205,0.8)] dark:focus:bg-[#120D1F]/70 dark:focus:ring-[rgba(99,92,205,0.18)] dark:active:border-[rgba(99,92,205,0.8)] dark:disabled:border-[rgba(99,92,205,0.28)] dark:disabled:bg-[#120D1F]/50 dark:disabled:text-white [font-weight:400]"
                                                />
                                                {loginStage === 'code' && (
                                                    <button type="button" onClick={() => { setLoginStage('email'); setLoginCode('') }} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#BDB6FF] text-xs font-semibold hover:text-white">Change</button>
                                                )}
                                            </div>
                                        </div>
                                        {loginStage === 'code' && (
                                            <div className="group animate-fade-in">
                                                <label htmlFor="login-code" className="block text-[10px] font-medium uppercase tracking-[0.2em] mb-2 text-primary-text-muted dark:text-white/70 group-focus-within:text-[#BDB6FF] transition-colors">Verification Code</label>
                                                <input
                                                    id="login-code"
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    placeholder="------"
                                                    value={loginCode}
                                                    onChange={(e) => setLoginCode(e.target.value)}
                                                    disabled={isProcessingAuth}
                                                    autoFocus
                                                    className="w-full appearance-none rounded-xl border border-primary-border bg-primary-light px-5 py-4 text-base font-normal text-[var(--text-secondary)] outline-none transition-all placeholder:text-primary-text-muted/80 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus-visible:outline-none active:border-primary/50 disabled:cursor-not-allowed disabled:opacity-65 dark:border-[rgba(99,92,205,0.28)] dark:bg-[#120D1F]/50 dark:text-white dark:placeholder:text-white/60 dark:focus:border-[rgba(99,92,205,0.8)] dark:focus:bg-[#120D1F]/70 dark:focus:ring-[rgba(99,92,205,0.18)] dark:active:border-[rgba(99,92,205,0.8)] [font-weight:400]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isProcessingAuth || (loginStage === 'email' && !loginEmail) || (loginStage === 'code' && !loginCode)}
                                        className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-primary px-5 py-4 text-base font-semibold tracking-tight text-white shadow-lg shadow-primary/14 transition-all hover:bg-primary-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-primary disabled:text-white/70 disabled:shadow-none"
                                    >
                                        {isProcessingAuth ? (
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            loginStage === 'email' ? 'Send Sign-In Code' : 'Sign In'
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                        <IntegratedFooter className="flex-shrink-0 pt-8" alignment="center" />
                    </div>
                </>
            )}
        </div>
    );
};

export default HomePage;
