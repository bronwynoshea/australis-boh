import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import LedgerPage from './pages/LedgerPage';

interface LedgerAppProps {
  isAdmin?: boolean;
}

// Mobile header component for Ledger
const LedgerMobileHeader: React.FC = () => (
  <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Finance</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Ledger</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Finance & Revenue</p>
    </div>
  </header>
);

// Desktop page header for Ledger
const LedgerPageHeader: React.FC = () => (
  <div className="hidden lg:block mb-6">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Finance</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Ledger</h1>
      <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Finance & Revenue</p>
    </div>
  </div>
);

// Placeholder pages for Ledger sub-routes
const TransactionsPage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Transactions</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Transaction history will appear here.
    </p>
  </div>
);

const InvoicesPage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Invoices</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Invoice management will appear here.
    </p>
  </div>
);

const LedgerReportsPage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Reports</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Financial reports will appear here.
    </p>
  </div>
);

const LedgerApp: React.FC<LedgerAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<LedgerMobileHeader />}>
      <LedgerPageHeader />
      <Routes>
        <Route index element={<LedgerPage />} />
        <Route path="dashboard" element={<LedgerPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="reports" element={<LedgerReportsPage />} />
        <Route path="*" element={<Navigate to="/ledger" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default LedgerApp;
