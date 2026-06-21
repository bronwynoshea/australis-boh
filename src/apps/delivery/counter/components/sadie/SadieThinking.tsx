// Thinking indicator for Sadie (waiting for LLM response)

import React from 'react';

export function SadieThinking() {
  return (
    <div className="flex items-center space-x-1 mt-2">
      <span className="h-2 w-2 rounded-full bg-boh-primary animate-pulse" />
      <span className="h-2 w-2 rounded-full bg-boh-primary animate-pulse [animation-delay:120ms]" />
      <span className="h-2 w-2 rounded-full bg-boh-primary animate-pulse [animation-delay:240ms]" />
    </div>
  );
}

