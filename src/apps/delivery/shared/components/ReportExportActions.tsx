import React, { useState } from 'react';

interface ReportExportActionsProps {
  reportTitle: string;
  reportContent?: string;
  onPrint?: () => void;
  className?: string;
}

const ReportExportActions: React.FC<ReportExportActionsProps> = ({
  reportTitle,
  reportContent,
  onPrint,
  className = '',
}) => {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleCopyToClipboard = async () => {
    const content = reportContent || '';
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ReportExportActions] Failed to copy:', error);
    }
  };

  const generateEmailBody = () => {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `Subject: ${reportTitle} - ${today}

Hi team,

Please find below the ${reportTitle}:

${reportContent || '[Report content would appear here]'}

---
Generated from BOH Menu
`;
  };

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {/* Print Button */}
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
          title="Print or save as PDF"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span className="hidden sm:inline">Print / PDF</span>
          <span className="sm:hidden">Print</span>
        </button>

        {/* Copy Summary Button */}
        <button
          onClick={handleCopyToClipboard}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
          title="Copy report summary"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-boh-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-boh-primary dark:text-boh-primary">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>

        {/* Email Button */}
        <button
          onClick={() => setIsEmailModalOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 transition-colors"
          title="Prepare email summary"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span className="hidden sm:inline">Email Summary</span>
          <span className="sm:hidden">Email</span>
        </button>
      </div>

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEmailModalOpen(false)}
        >
          <div
            className="bg-boh-surface dark:bg-boh-surface rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                Prepare Email Summary
              </h3>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1 rounded-md hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
                Copy the content below and paste it into your email client. You can edit it before sending.
              </p>

              <div className="relative">
                <pre className="w-full h-64 p-4 text-sm font-mono bg-boh-bg-light dark:bg-boh-bg rounded-lg border border-boh-border-light dark:border-boh-border overflow-auto whitespace-pre-wrap text-boh-text-light dark:text-boh-text">
                  {generateEmailBody()}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateEmailBody());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-boh-primary text-white rounded hover:bg-boh-primary/90 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg rounded-lg transition-colors"
                >
                  Close
                </button>
                <a
                  href={`mailto:?subject=${encodeURIComponent(reportTitle)}&body=${encodeURIComponent(reportContent || '')}`}
                  className="px-4 py-2 text-sm font-medium bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
                  onClick={() => setIsEmailModalOpen(false)}
                >
                  Open in Email Client
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportExportActions;
