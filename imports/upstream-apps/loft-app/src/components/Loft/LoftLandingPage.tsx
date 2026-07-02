import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

const LoftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <>
    <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
    <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
  </>
);

interface LoftLandingPageProps {
  onBackToCafe: () => void;
}

const LoftLandingPage: React.FC<LoftLandingPageProps> = () => {
  const [joinInput, setJoinInput] = useState('');

  const normalizedJoinPath = useMemo(() => {
    const raw = joinInput.trim();
    if (!raw) return '';

    const extractPath = (value: string) => {
      try {
        const parsed = new URL(value);
        return parsed.hash?.startsWith('#/')
          ? parsed.hash.slice(1).split('?')[0]
          : parsed.pathname.split('?')[0];
      } catch {
        const hashIndex = value.indexOf('#/');
        if (hashIndex >= 0) return value.slice(hashIndex + 1).split('?')[0];
        return value.split('?')[0].replace(/^#/, '');
      }
    };

    const path = extractPath(raw).replace(/\/+$/, '');
    const roomMatch = path.match(/\/room\/([^/]+)$/i);
    if (roomMatch?.[1]) return `/room/${roomMatch[1]}`;

    const personalMatch = path.match(/\/personal\/([^/]+)$/i);
    if (personalMatch?.[1]) return `/personal/${personalMatch[1]}`;

    const code = raw.replace(/^#?\//, '').trim();
    if (!code || code.includes('/') || code.includes('://')) return '';

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(code) ? `/room/${code}` : `/personal/${code}`;
  }, [joinInput]);

  const normalizedRoomId = normalizedJoinPath.replace(/^\/(?:room|personal)\//, '');

  const handleJoin = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!normalizedJoinPath) return;
    window.location.hash = normalizedJoinPath;
  };

  const handleMemberLogin = () => {
    sessionStorage.setItem('loft_post_login_redirect', '/lobby');
    window.location.hash = '/loft/login';
  };

  return (
    <div className="min-h-screen w-full bg-[var(--loft-bg)] text-main relative overflow-x-hidden">
      <img
        src="/loft_screens/2.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-24 lg:hidden loft-cinematic-image"
      />
      <div className="absolute inset-0 loft-cinematic-grade lg:hidden" />
      <div className="absolute inset-0 bg-[var(--loft-bg)]/84 dark:bg-[#10163a]/84 lg:hidden" />
      <main className="relative z-10 min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[minmax(380px,1.08fr)_minmax(0,0.92fr)]">
        <section className="flex min-h-screen lg:h-screen lg:min-h-0 flex-col overflow-y-auto no-scrollbar px-5 py-5 md:px-8 md:py-6 xl:px-10 xl:py-8 lg:order-2">
          <header className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '/';
              }}
              className="flex items-center gap-3"
              aria-label="Loft home"
            >
              <LoftIcon className="w-10 h-10" />
              <span className="text-2xl font-black tracking-tight text-cafe uppercase">Loft</span>
            </button>
            <button
              type="button"
              onClick={handleMemberLogin}
              className="rounded-full border border-[var(--loft-border)] bg-[var(--loft-surface)]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted transition-colors hover:text-cafe"
            >
              Member login
            </button>
          </header>

          <div className="flex flex-1 items-center py-8 lg:py-6 xl:py-10">
            <div className="w-full max-w-2xl space-y-5 2xl:space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl xl:text-7xl 2xl:text-8xl font-black tracking-tight leading-[0.92] text-main">
                  Private tables for real-time work.
                </h1>
                <p className="max-w-xl text-base xl:text-[1.05rem] 2xl:text-lg leading-relaxed text-muted">
                  Join coaching sessions, interviews, onboarding calls, webinars, and live conversations with your Loft invite link.
                </p>
              </div>

              <div className="loft-card p-4 md:p-5">
                <form onSubmit={handleJoin} className="grid sm:grid-cols-[1fr_auto] gap-3">
                  <input
                    value={joinInput}
                    onChange={(event) => setJoinInput(event.target.value)}
                    placeholder="Paste your Loft invite link"
                    className="loft-input rounded-2xl px-5 py-3.5 md:py-4 text-sm font-medium text-main placeholder:text-muted bg-[var(--loft-surface)]"
                    aria-label="Paste your Loft invite link"
                  />
                  <button
                    type="submit"
                    disabled={!normalizedJoinPath}
                    className="rounded-2xl bg-cafe text-white px-6 py-3.5 md:py-4 text-[11px] font-black uppercase tracking-[0.25em] shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  >
                    Join
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>

          <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[var(--loft-border)] pt-5 text-[10px] font-black uppercase tracking-[0.28em] text-muted">
            <span>A JOBZCAFE® product</span>
            <span>Built for coaching, hiring, onboarding, and live sessions</span>
          </footer>
        </section>

        <aside className="hidden lg:block sticky top-0 h-screen overflow-hidden bg-black lg:order-1">
          <img
            src="/loft_screens/2.png"
            alt="Loft room preview"
            className="absolute inset-0 w-full h-full object-cover loft-cinematic-image"
          />
          <div className="absolute inset-0 loft-cinematic-grade" />
          <div className="absolute inset-0 loft-cinematic-grade-soft" />
          <div className="absolute left-8 top-8 right-8 flex items-center justify-between">
            <div className="flex items-center gap-3 rounded-2xl bg-black/35 border border-white/15 px-4 py-3 text-white backdrop-blur-md">
              <LoftIcon className="w-8 h-8" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">Live table</p>
                <p className="text-sm font-black">Onboarding session</p>
              </div>
            </div>
            <div className="rounded-full bg-emerald-400/20 border border-emerald-300/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">
              Ready
            </div>
          </div>
          <div className="absolute left-8 right-8 bottom-8 grid grid-cols-3 gap-3">
            {[
              ['Host', 'Access ready', 'bg-cafe/80'],
              ['Guest', 'Waiting safely', 'bg-[#57cbe4]/80'],
              ['Session', 'Share capable', 'bg-[#6ee7b7]/80'],
            ].map(([label, detail, tone]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/18 bg-[#111735]/34 p-4 text-white shadow-[0_24px_80px_rgba(5,8,22,0.28)] backdrop-blur-xl"
              >
                <div className="mb-6 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
                  <span className="h-px flex-1 bg-white/18" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">{label}</p>
                <p className="mt-1 text-sm font-black text-white/92">{detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LoftLandingPage;
