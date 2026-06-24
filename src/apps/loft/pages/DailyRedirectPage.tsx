import React from 'react';
import { Link } from 'react-router-dom';

const DailyRedirectPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#10162f] text-white flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className="h-10 w-10" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-white/60">Session complete</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">You’ve left the Loft table.</h1>
        <p className="mt-4 text-sm leading-6 text-white/70">
          You can close this window or return to Loft inside Back of House.
        </p>
        <Link
          to="/apps/loft"
          className="mt-7 inline-flex rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-[#10162f] transition hover:brightness-95"
        >
          Return to Loft
        </Link>
      </section>
    </main>
  );
};

export default DailyRedirectPage;
