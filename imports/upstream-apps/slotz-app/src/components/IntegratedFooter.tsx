import React from 'react';

const IntegratedFooter: React.FC<{ className?: string; alignment?: 'left' | 'right' | 'center' }> = ({ className, alignment = 'center' }) => {
  const alignClass = {
    left: 'md:text-left',
    right: 'md:text-right',
    center: 'md:text-center',
  }[alignment];

  const justifyClass = {
    left: 'md:justify-start',
    right: 'md:justify-end',
    center: 'md:justify-center',
  }[alignment];

  return (
    <div className={`text-xs text-primary-text-muted/80 dark:text-white/60 font-semibold uppercase tracking-widest text-center ${alignClass} ${className}`}>
      <p className="mb-1">&copy; 2026 JOBZ CAFE&reg;</p>
      <div className={`flex items-center justify-center ${justifyClass} gap-x-1`}>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center rounded-md px-1.5 transition-colors hover:text-[#BDB6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Privacy</a>
        <span>&middot;</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center rounded-md px-1.5 transition-colors hover:text-[#BDB6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Terms</a>
        <span>&middot;</span>
        <a href="mailto:success@jobzcafe.com" className="inline-flex min-h-8 items-center rounded-md px-1.5 transition-colors hover:text-[#BDB6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Contact</a>
      </div>
    </div>
  );
};

export default IntegratedFooter;
