import React from 'react';

const DailyRedirectPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#10162f] text-white flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className="h-10 w-10" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">Session complete</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You’ve left the interview room.</h1>
        <p className="mt-4 text-sm leading-6 text-white/70">
          You can close this window now.
        </p>
      </section>
    </main>
  );
};

export default DailyRedirectPage;
