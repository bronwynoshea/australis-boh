import React from "react";

interface AnswerEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
  label?: string;
}

const AnswerEditor: React.FC<AnswerEditorProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
  isSubmitting,
  placeholder = "Type your response to Harper here.",
  label = "Answer",
}) => {
  const canSubmit = !disabled && value.trim().length > 0 && !isSubmitting;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-boh-text-light dark:text-boh-text">{label}</label>
        <textarea
          className="min-h-[180px] w-full resize-y rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-primary/80 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default AnswerEditor;
