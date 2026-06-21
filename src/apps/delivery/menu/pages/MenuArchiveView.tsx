import React from 'react';

const MenuArchiveView: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-boh-bg-light dark:bg-boh-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-1">
            <span className="text-boh-text-light dark:text-boh-text font-medium">Menu</span>
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Archive</span>
          </nav>
          <h1 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Archive</h1>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="rounded-2xl border border-dashed border-boh-border-light dark:border-boh-border bg-boh-surface-light/90 dark:bg-boh-surface/70 p-8 text-center">
          <h2 className="text-2xl font-semibold text-boh-text-light dark:text-boh-text mb-2">Archive view under construction</h2>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-2xl mx-auto">
            Live/completed, cancelled, and archived initiatives will be separated here to keep the active board focused. Placeholder keeps routing intact while the filters and tables are built.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MenuArchiveView;
