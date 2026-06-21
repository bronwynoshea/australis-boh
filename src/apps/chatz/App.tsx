import React from 'react';
import { BOHShell, bohApps } from '../../boh/navigation';

interface ChatzAppProps {
  isAdmin?: boolean;
}

const App: React.FC<ChatzAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin}>
      <main className="flex min-h-[60vh] items-center justify-center p-8 text-center">
        <section className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
            Hybrid App
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
            Chatz
          </h1>
          <p className="mt-3 text-sm leading-6 text-boh-text-sub-light dark:text-boh-text-sub">
            Messaging workspace placeholder. This app has not been built yet.
          </p>
        </section>
      </main>
    </BOHShell>
  );
};

export default App;
