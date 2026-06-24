import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BohSlideOver from './boh/BohSlideOver';

interface LoginProps {
  onLogin: (email: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [authMode, setAuthMode] = useState<'signin' | 'create'>('signin');
  const [legalPanel, setLegalPanel] = useState<'terms' | 'privacy' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [codeSentMessage, setCodeSentMessage] = useState('');

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setCodeSentMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const lastRequestRaw = localStorage.getItem('boh_otp_last_request_at');
      if (lastRequestRaw) {
        const lastRequest = Number(lastRequestRaw);
        if (Number.isFinite(lastRequest)) {
          const elapsed = Date.now() - lastRequest;
          if (elapsed < 60_000) {
            setErrorMessage(
              'We just sent a verification email. Please wait a minute before requesting another code.',
            );
            setLoading(false);
            return;
          }
        }
      }

      const { data: existingSessionData } = await supabase.auth.getSession();
      const existingEmail = existingSessionData.session?.user?.email?.trim().toLowerCase();

      if (existingEmail && existingEmail !== normalizedEmail) {
        await supabase.auth.signOut();
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: authMode === 'create',
        },
      });

      if (error) {
        const status = (error as any)?.status;

        if (status === 429 || error.message?.toLowerCase().includes('rate')) {
          setErrorMessage('Too many attempts. Please wait a couple of minutes and try again.');
        } else {
          setErrorMessage(error.message || 'Failed to send verification code. Please try again.');
        }

        setLoading(false);
        return;
      }

      localStorage.setItem('boh_otp_last_request_at', String(Date.now()));

      setCodeSentMessage(
        authMode === 'create'
          ? `Account verification code sent to ${normalizedEmail}`
          : `Verification code sent to ${normalizedEmail}`,
      );
      setStep('code');
      setLoading(false);

      setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error('[BOH] OTP send error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = code.length === 6
      ? code.split('')
      : Array(6)
          .fill('')
          .map((_, i) => code[i] || '');

    newCode[index] = value || '';
    const codeString = newCode.join('');
    setCode(codeString);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .slice(0, 6)
      .replace(/\D/g, '');

    if (pastedData.length === 6) {
      setCode(pastedData);
      codeInputRefs.current[5]?.focus();
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: 'email',
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid verification code.');
        setCode('');
        setLoading(false);
        codeInputRefs.current[0]?.focus();
        return;
      }

      if (data.session) {
        try {
          const verifiedAuthEmail = data.session.user.email?.trim().toLowerCase();

          if (verifiedAuthEmail !== normalizedEmail) {
            await supabase.auth.signOut();
            setErrorMessage('This code belongs to a different email address. Please request a new code.');
            setCode('');
            setLoading(false);
            codeInputRefs.current[0]?.focus();
            return;
          }

          const { data: linkedBohUser, error: linkedBohUserError } = await supabase
            .from('boh_user')
            .select('id, email')
            .eq('auth_user_id', data.session.user.id)
            .eq('app_context', 'boh')
            .maybeSingle();

          if (linkedBohUserError) {
            throw linkedBohUserError;
          }

          if (linkedBohUser) {
            const linkedEmail = linkedBohUser.email?.trim().toLowerCase();
            if (linkedEmail !== normalizedEmail) {
              await supabase.auth.signOut();
              setErrorMessage('This browser was signed in to a different BOH user. Please request a new code.');
              setCode('');
              setLoading(false);
              codeInputRefs.current[0]?.focus();
              return;
            }
          } else {
            const { data: emailUser, error: emailError } = await supabase
              .from('boh_user')
              .select('id, auth_user_id')
              .eq('email', normalizedEmail)
              .eq('app_context', 'boh')
              .maybeSingle();

            if (!emailError && emailUser && !emailUser.auth_user_id) {
              await supabase
                .from('boh_user')
                .update({ auth_user_id: data.session.user.id })
                .eq('id', emailUser.id);
            } else {
              await supabase.auth.signOut();
              setErrorMessage(
                authMode === 'create'
                  ? 'Your BOH account was created, but workspace access has not been granted yet. Contact support or your workspace owner to activate access.'
                  : 'No BOH workspace access found. Please contact support or your workspace owner if you expected access.',
              );
              setCode('');
              setLoading(false);
              codeInputRefs.current[0]?.focus();
              return;
            }
          }

          onLogin(normalizedEmail);
          navigate('/boh');
        } catch (err) {
          console.error('[BOH] User validation error:', err);
          setErrorMessage('Unable to verify BOH access. Please contact your admin.');
          setCode('');
          setLoading(false);
          codeInputRefs.current[0]?.focus();
        }
      } else {
        setErrorMessage('Authentication failed. Please try again.');
        setCode('');
        setLoading(false);
        codeInputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('[BOH] OTP verify error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setCode('');
      setLoading(false);
      codeInputRefs.current[0]?.focus();
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setErrorMessage('');
    setCodeSentMessage('');
  };

  const legalContent = legalPanel === 'terms'
    ? {
        title: 'Terms of Use',
        description: 'JOBZCAFE® Back of House access',
        sections: [
          {
            heading: 'Invitation-only workspace',
            body:
              'Back of House is a private JOBZCAFE® workspace. Australis is a division of JOBZCAFE® and may provide this BOH workspace for Australis teams, customers, and approved collaborators. Use is limited to invited team members and approved collaborators.',
          },
          {
            heading: 'Account responsibility',
            body:
              'Keep your sign-in email and verification codes secure. Do not share workspace access or use another person\'s account.',
          },
          {
            heading: 'Operational data',
            body:
              'Information inside BOH is for JOBZCAFE® operations, Australis operations where applicable, delivery, product, and support work. Treat customer, candidate, staff, and business records as confidential.',
          },
          {
            heading: 'Appropriate use',
            body:
              'Use BOH tools only for authorised work. Activity may be logged for security, audit, and service improvement.',
          },
        ],
      }
    : {
        title: 'Privacy',
        description: 'How BOH handles workspace information',
        sections: [
          {
            heading: 'Information we process',
            body:
              'BOH may process your sign-in email, profile details, access records, audit activity, uploaded files, tickets, notes, and app-specific operational data.',
          },
          {
            heading: 'Why it is used',
            body:
              'This information is used to authenticate access, run BOH applications, support JOBZCAFE® services and Australis services where applicable, maintain security, and keep operational records accurate.',
          },
          {
            heading: 'Access and retention',
            body:
              'Access is limited by BOH permissions. Records are retained where needed for operations, compliance, audit, support, and service continuity.',
          },
          {
            heading: 'Support',
            body:
              'For privacy or access questions, contact your JOBZCAFE® admin, Australis support where applicable, or the BOH owner responsible for your workspace access.',
          },
        ],
      };

  return (
    <div className="login-container">
      <div className="login-shell">
        <section className="login-visual-panel" aria-label="Back of House cafe kitchen entrance">
          <img src="/boh-login/back-of-house-doors.png" alt="" aria-hidden="true" />
          <div className="login-visual-overlay" />
        </section>

        <section className="login-panel" aria-label="Back of House access">
          <div className="login-box">
            <div className="login-brand" aria-label="Australis">
              <img src="/Assets/australis-logo-mark.png" alt="" aria-hidden="true" />
              <span className="logo-main">Australis</span>
            </div>
            <h1>{authMode === 'create' ? 'Create your BOH account' : 'Sign in to Back of House'}</h1>

            {step === 'email' ? (
              <form className="login-form" onSubmit={handleEmailSubmit}>
                <div className="form-group">
                  <label htmlFor="login-email">Email address</label>
                  <input
                    type="email"
                    id="login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    placeholder="Enter your email address"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  {authMode === 'create' ? 'Create account and send code' : 'Send verification code'}
                </button>

                {errorMessage && <div className="error-message">{errorMessage}</div>}

                <p className="helper-text">
                  {authMode === 'create'
                    ? 'Create a BOH account with your email. Workspace access is activated by your workspace owner.'
                    : 'Use your workspace email to receive a secure sign-in code.'}
                </p>

                <button
                  type="button"
                  className="btn-text-link"
                  onClick={() => {
                    setAuthMode(authMode === 'create' ? 'signin' : 'create');
                    setErrorMessage('');
                    setCodeSentMessage('');
                  }}
                  disabled={loading}
                >
                  {authMode === 'create'
                    ? 'Already have an account? Sign in'
                    : 'Create account'}
                </button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleCodeSubmit}>
                <div className="form-group">
                  <label>Enter verification code</label>
                  <p className="code-instructions">
                    We sent a 6-digit code to <strong>{email}</strong>
                  </p>

                  <div className="code-inputs" onPaste={handlePaste}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        ref={(el) => (codeInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={code[index] || ''}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        className="code-input"
                        required
                      />
                    ))}
                  </div>

                  {codeSentMessage && (
                    <div className="success-message">{codeSentMessage}</div>
                  )}
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                  disabled={loading || code.length !== 6}
                >
                  Verify code
                </button>

                {errorMessage && <div className="error-message">{errorMessage}</div>}

                <button
                  type="button"
                  className="btn-text-link"
                  onClick={handleBackToEmail}
                  disabled={loading}
                >
                  Back to email
                </button>
              </form>
            )}

            <div className="login-legal-links" aria-label="Legal links">
              <button type="button" onClick={() => setLegalPanel('terms')}>
                Terms
              </button>
              <span aria-hidden="true">/</span>
              <button type="button" onClick={() => setLegalPanel('privacy')}>
                Privacy
              </button>
            </div>
          </div>
        </section>
      </div>

      <BohSlideOver
        isOpen={legalPanel !== null}
        title={legalContent.title}
        description={legalContent.description}
        onClose={() => setLegalPanel(null)}
        closeLabel={`Close ${legalContent.title}`}
        widthClassName="md:max-w-lg"
        contentClassName="p-5 sm:p-6"
      >
        <div className="space-y-5 text-sm leading-6 text-boh-text-sub-light dark:text-boh-text-sub">
          {legalContent.sections.map((section) => (
            <section key={section.heading} className="space-y-1.5">
              <h4 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">
                {section.heading}
              </h4>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </BohSlideOver>
    </div>
  );
};

export default Login;
