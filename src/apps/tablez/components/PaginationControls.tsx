import React from 'react';

interface PaginationControlsProps {
  className?: string;
  currentPage: number;
  pageSize: 10 | 25 | 50 | 100;
  totalItems: number;
  pageSizeOptions: Array<10 | 25 | 50 | 100>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 25 | 50 | 100) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  className,
  currentPage,
  pageSize,
  totalItems,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages && totalItems > 0;

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-boh-border-light dark:border-boh-border pt-3">
        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">
          Showing {startItem}–{endItem} of {totalItems} tasks
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canGoPrevious}
              className="px-3 py-2 text-sm font-medium rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canGoNext}
              className="px-3 py-2 text-sm font-medium rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-boh-bg-light dark:hover:bg-boh-bg"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">Rows per page</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as 10 | 25 | 50 | 100)}
              className="text-sm border border-boh-border-light dark:border-boh-border rounded-md px-2 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaginationControls;
