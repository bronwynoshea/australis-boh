// Compact error banner for Sadie panel

import React from 'react';

interface SadieErrorBannerProps {
  message: string;
}

const SadieErrorBanner: React.FC<SadieErrorBannerProps> = ({ message }) => {
  return (
    <div className="flex-shrink-0 px-4 py-3">
      <div className="max-w-md mx-auto bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
        {message}
      </div>
    </div>
  );
};

export default SadieErrorBanner;

