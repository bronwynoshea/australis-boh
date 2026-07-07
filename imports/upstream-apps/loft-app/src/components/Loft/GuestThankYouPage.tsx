import React from 'react';

const LoftIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <>
    <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
    <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
  </>
);

const GuestThankYouPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[var(--loft-bg)] text-main relative overflow-x-hidden">
      <img
        src="/loft_screens/2.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-24 lg:hidden"
      />
      <div className="absolute inset-0 bg-[var(--loft-bg)]/84 dark:bg-[#10163a]/84 lg:hidden" />

      <main className="relative z-10 min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)]">
        <section className="flex min-h-screen lg:h-screen lg:min-h-0 flex-col overflow-y-auto no-scrollbar px-5 py-5 md:px-8 md:py-6 xl:px-10 xl:py-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3" aria-label="Loft session complete">
              <LoftIcon className="w-10 h-10" />
              <span className="text-2xl font-semibold tracking-tight text-cafe uppercase">Loft</span>
            </div>
          </header>

          <div className="flex flex-1 items-center py-8 lg:py-6 xl:py-10">
            <div className="w-full max-w-2xl space-y-5 2xl:space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Session complete
                </p>
                <h1 className="max-w-xl text-3xl md:text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.06] text-main">
                  The table session has ended.
                </h1>
                <p className="max-w-xl text-sm xl:text-base leading-relaxed text-muted">
                  Thanks for joining. You can close this window now.
                </p>
              </div>

              <div className="loft-card p-4 md:p-5 space-y-4">
                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Session ended. No further action is needed.
                </p>
              </div>
            </div>
          </div>

          <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[var(--loft-border)] pt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            <span>A JOBZCAFE® product</span>
            <span>Built for coaching, hiring, onboarding, and live sessions</span>
          </footer>
        </section>

        <aside className="hidden lg:block sticky top-0 h-screen overflow-hidden bg-black">
          <img
            src="/loft_screens/2.png"
            alt="Loft session preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#121735]/18 dark:from-[#10163a]/58 dark:via-[#10163a]/18 dark:to-[#10163a]/58" />
          <div className="absolute left-8 top-8 right-8 flex items-center justify-between">
            <div className="flex items-center gap-3 rounded-2xl bg-black/35 border border-white/15 px-4 py-3 text-white backdrop-blur-md">
              <LoftIcon className="w-8 h-8" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Live table</p>
                <p className="text-sm font-semibold">Session complete</p>
              </div>
            </div>
            <div className="rounded-full bg-cafe/20 border border-cafe/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cafe">
              Closed
            </div>
          </div>
          <div className="absolute left-8 right-8 bottom-8 grid grid-cols-3 gap-3">
            {[
              ['Table', 'Ended'],
              ['Guest', 'Released'],
              ['Loft', 'Ready'],
            ].map(([label, detail], index) => (
              <div key={label} className="rounded-2xl bg-black/38 border border-white/15 p-4 text-white backdrop-blur-md">
                <div className={`w-9 h-9 rounded-xl ${index === 0 ? 'bg-cafe' : index === 1 ? 'bg-[#57cbe4]' : 'bg-[#6ee7b7]'} mb-6`} />
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">{label}</p>
                <p className="mt-1 text-sm font-semibold">{detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default GuestThankYouPage;
