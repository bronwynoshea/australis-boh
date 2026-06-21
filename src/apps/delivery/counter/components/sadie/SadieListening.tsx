// Listening indicator for Sadie (microphone actively recording)

import React from 'react';

export function SadieListening() {
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-14 w-14 rounded-full bg-boh-primary/30 animate-ping" />
        <div className="relative h-10 w-10 rounded-full bg-boh-primary flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
      </div>
      <p className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Sadie is listening…</p>
    </div>
  );
}

