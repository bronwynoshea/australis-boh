import React from "react";

interface QuickServePreviewProps {
  content: string;
  onRegenerate: () => void;
  onSave: () => void;
}

const QuickServePreview: React.FC<QuickServePreviewProps> = ({ content, onRegenerate, onSave }) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Draft output</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-1.5 text-xs font-medium text-boh-text-light hover:bg-boh-bg-light/70 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          >
            Regenerate (mock)
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/80"
          >
            Save Draft (mock)
          </button>
        </div>
      </div>
      <div className="rounded-md border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-3 text-sm text-boh-text-light dark:text-boh-text min-h-[160px] whitespace-pre-wrap">
        {content || "Generated content will appear here."}
      </div>
    </section>
  );
};

export default QuickServePreview;
