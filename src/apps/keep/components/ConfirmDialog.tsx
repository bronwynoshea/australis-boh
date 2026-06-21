import React from 'react';
import { XIcon } from './Icons';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel,
  confirmingLabel,
  cancelLabel = 'Cancel',
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-brand-bg-dark/50 dark:bg-brand-bg-dark/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-boh-border-light dark:border-boh-border">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="p-1.5 rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub disabled:opacity-50"
            aria-label="Close dialog"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-boh-text-light dark:text-boh-text">
            {body}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-boh-border-light dark:border-boh-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 text-sm rounded-lg border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="px-4 py-2 text-sm rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? (confirmingLabel || confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
