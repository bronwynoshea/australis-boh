// Chat message bubbles for Sadie conversation

import React from 'react';
import type { SadieMessage } from './SadieTypes';

interface SadieMessageListProps {
  messages: SadieMessage[];
  className?: string;
}

const SadieMessageList: React.FC<SadieMessageListProps> = ({ messages, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[80%] rounded-xl p-3
              ${message.role === 'user'
                ? 'bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text'
                : 'bg-boh-primary/10 dark:bg-boh-primary/20 border border-boh-primary/20 dark:border-boh-primary/30 text-boh-text-light dark:text-boh-text'
              }
            `}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SadieMessageList;

