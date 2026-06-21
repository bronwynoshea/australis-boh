// Entry card for Sadie ticket intake

import React from 'react';

interface SadieLauncherProps {
  onStartVoice: () => void;
  onStartType: () => void;
}

const SadieLauncher: React.FC<SadieLauncherProps> = ({
  onStartVoice,
  onStartType,
}) => {
  return (
    <main className="flex-1 px-4 py-6">
      <div className="max-w-md mx-auto bg-boh-surface-light dark:bg-boh-surface rounded-2xl p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">Create a Ticket</h1>
        <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">
          Talk to Sadie and describe your issue. You'll review everything before submitting.
        </p>

        <button
          onClick={onStartVoice}
          className="w-full mt-4 px-4 py-3 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 transition-colors"
        >
          Start talking with Sadie
        </button>

        <button
          onClick={onStartType}
          className="block text-sm text-boh-text-sub-light dark:text-boh-text-sub underline mt-2 hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
        >
          Prefer to type instead?
        </button>
      </div>
    </main>
  );
};

export default SadieLauncher;

