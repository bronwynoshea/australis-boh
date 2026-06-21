// Text input fallback for Sadie

import React, { KeyboardEvent } from 'react';

interface SadieTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const SadieTextInput: React.FC<SadieTextInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}) => {
  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      // Don't clear here - parent will clear on successful send
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="
          flex-1 rounded-2xl px-4 py-3
          bg-boh-surface-light dark:bg-boh-surface
          text-boh-text-light dark:text-boh-text
          border border-boh-border-light dark:border-boh-border
          resize-none focus:outline-none focus:ring-2 focus:ring-boh-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          placeholder:text-boh-text-sub-light dark:placeholder:text-boh-text-sub
        "
        style={{ maxHeight: '120px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="
          rounded-full p-3
          bg-boh-primary text-white
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:opacity-90 transition-opacity
          focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2
        "
        aria-label="Send message"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </div>
  );
};

export default SadieTextInput;

