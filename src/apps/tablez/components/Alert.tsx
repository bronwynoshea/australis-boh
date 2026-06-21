import React from 'react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

const STYLES: Record<AlertVariant, { container: string; title: string; body: string }> = {
  success: {
    container: 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100',
    title: 'text-green-900 dark:text-green-100',
    body: 'text-green-800 dark:text-green-200',
  },
  error: {
    container: 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100',
    title: 'text-red-900 dark:text-red-100',
    body: 'text-red-800 dark:text-red-200',
  },
  warning: {
    container: 'bg-orange-50 text-orange-900 dark:bg-orange-900/20 dark:text-orange-100',
    title: 'text-orange-900 dark:text-orange-100',
    body: 'text-orange-800 dark:text-orange-200',
  },
  info: {
    container: 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100',
    title: 'text-blue-900 dark:text-blue-100',
    body: 'text-blue-800 dark:text-blue-200',
  },
};

const Alert: React.FC<AlertProps> = ({ variant, title, children, actions, className }) => {
  const s = STYLES[variant];

  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${s.container} ${className || ''}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <div className={`font-medium ${s.title}`.trim()}>{title}</div>}
          {children && <div className={`mt-1 ${s.body}`.trim()}>{children}</div>}
        </div>
        {actions ? <div className="flex-shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
};

export default Alert;
