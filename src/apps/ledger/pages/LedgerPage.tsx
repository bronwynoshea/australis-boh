import React from 'react';

const LedgerPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border shadow-sm">
        <div className="w-full px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">Ledger</span>
              </div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text mb-2">Ledger</h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub">Finance & Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Empty State */}
          <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">
              Ledger Coming Soon
            </h3>
            <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
              Financial tracking and reporting will appear here. This section will be used for finance and revenue management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerPage;
