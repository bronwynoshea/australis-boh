import React from 'react';
import { createPortal } from 'react-dom';

interface BohSlideOverProps {
  isOpen: boolean;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  headerAfter?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  widthClassName?: string;
  contentClassName?: string;
}

const BohSlideOver: React.FC<BohSlideOverProps> = ({
  isOpen,
  title,
  description,
  children,
  headerAfter,
  footer,
  onClose,
  closeLabel = 'Close panel',
  closeDisabled = false,
  widthClassName = 'sm:max-w-xl',
  contentClassName = 'p-4 sm:p-6',
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={closeDisabled ? undefined : onClose}
        className="absolute inset-0 cursor-default bg-boh-text-light/35 dark:bg-black/50"
      />
      <aside className={`absolute bottom-0 right-0 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-xl border border-boh-border-light bg-boh-surface-light shadow-xl dark:border-boh-border dark:bg-boh-surface md:inset-y-0 md:max-h-none md:rounded-none md:border-y-0 md:border-r-0 ${widthClassName}`}>
        <div className="border-b border-boh-border-light px-4 pt-4 dark:border-boh-border sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{title}</h3>
              {description && (
                <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={closeLabel}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-boh-border-light text-boh-text-sub-light transition-colors hover:text-boh-primary disabled:opacity-50 dark:border-boh-border dark:text-boh-text-sub"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {headerAfter}
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto boh-hide-scrollbar ${contentClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="flex justify-end border-t border-boh-border-light p-4 dark:border-boh-border sm:p-6">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
};

export default BohSlideOver;
