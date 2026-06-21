import React, { useMemo, useState } from 'react';
import { CloseIcon } from '../../components/Icons';
import { getModuleStyling } from '../../../../../shared/styling';

export type InternalSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SadieTicketDraft {
  title: string;
  description: string;
  severity: InternalSeverity;
}

interface SadieReviewTicketProps {
  theme: 'dark' | 'light';
  initialDraft: SadieTicketDraft;
  onSubmit: (ticket: SadieTicketDraft) => void;
  onCancel: () => void;
  onChange?: (ticket: SadieTicketDraft) => void;
}

const severityOptions: {
  value: InternalSeverity;
  label: string;
  helper: string;
}[] = [
  {
    value: 'critical',
    label: "Can't work at all",
    helper: 'You are fully blocked from using part of the product.',
  },
  {
    value: 'high',
    label: 'Major inconvenience',
    helper: 'You can keep working, but this is significantly slowing you down.',
  },
  {
    value: 'medium',
    label: 'Minor inconvenience',
    helper: 'Annoying, but you can still work with some friction.',
  },
  {
    value: 'low',
    label: 'Nice to have',
    helper: 'A small improvement, tweak, or polish request.',
  },
];

const SadieReviewTicket: React.FC<SadieReviewTicketProps> = ({
  theme,
  initialDraft,
  onSubmit,
  onCancel,
  onChange,
}) => {
  const [draft, setDraft] = useState<SadieTicketDraft>(initialDraft);
  const { style } = getModuleStyling('BOH' as any, theme);

  const handleFieldChange = (field: keyof SadieTicketDraft, value: string) => {
    const next: SadieTicketDraft = {
      ...draft,
      [field]: field === 'severity' ? (value as InternalSeverity) : value,
    };
    setDraft(next);
    onChange?.(next);
  };

  const selectedSeverity = useMemo(
    () => severityOptions.find((s) => s.value === draft.severity) || severityOptions[1],
    [draft.severity]
  );

  const isValid = draft.title.trim().length > 0 && draft.description.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      title: draft.title.trim(),
      description: draft.description.trim(),
      severity: draft.severity,
    });
  };

  return (
    <div
      className={`fixed inset-0 z-[99990] flex items-center justify-center px-4 ${
        theme === 'dark' ? 'dark' : ''
      }`}
      style={style}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-xl rounded-2xl bg-boh-surface-light dark:bg-boh-surface dark:bg-primary shadow-2xl border border-black/10 dark:border-white/10 p-5 md:p-6">
        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-brand-bg-dark dark:text-white">
              Review your ticket
            </h2>
            <p className="mt-1 text-xs md:text-sm text-brand-bg-dark/70 dark:text-white/70">
              Sadie has drafted this issue based on your conversation. You can edit anything
              before submitting.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 -m-2 text-brand-bg-dark/60 dark:text-white/60 hover:text-brand-bg-dark dark:hover:text-white hover:bg-black/5 dark:hover:bg-boh-surface-light dark:hover:bg-boh-surface/10 rounded-full transition-colors flex-shrink-0"
            aria-label="Close review"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-brand-bg-dark/70 dark:text-white/70 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="jc-input w-full text-sm"
              placeholder="Short summary of the issue"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-brand-bg-dark/70 dark:text-white/70 mb-1.5">
              What&apos;s happening?
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              className="jc-textarea w-full min-h-[120px] text-sm"
              placeholder="This is the description Sadie created. Add or edit details if needed."
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-brand-bg-dark/70 dark:text-white/70 mb-2">
              How much is this affecting you?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {severityOptions.map((opt) => {
                const isActive = opt.value === draft.severity;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFieldChange('severity', opt.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors text-xs md:text-sm ${
                      isActive
                        ? 'border-[var(--module-color)] bg-[var(--module-color)]/10 text-brand-bg-dark dark:text-white'
                        : 'border-black/10 dark:border-white/20 bg-black/5 dark:bg-boh-surface-light dark:bg-boh-surface/5 text-brand-bg-dark/80 dark:text-white/80 hover:bg-black/10 dark:hover:bg-boh-surface-light dark:hover:bg-boh-surface/10'
                    }`}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-[0.7rem] md:text-xs opacity-80 mt-0.5">
                      {opt.helper}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[0.7rem] md:text-xs text-brand-bg-dark/60 dark:text-white/60">
              Internally, this will be stored as:{' '}
              <span className="font-semibold">
                {selectedSeverity.value.toUpperCase()}
              </span>
              .
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs md:text-sm font-medium border border-black/10 dark:border-white/20 text-brand-bg-dark/80 dark:text-white/80 bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-black/40 hover:bg-black/5 dark:hover:bg-boh-surface-light dark:hover:bg-boh-surface/10 transition-colors"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-white shadow-md bg-[var(--module-color)] hover:opacity-90 transition-opacity ${
              !isValid ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Submit ticket
          </button>
        </div>
      </div>
    </div>
  );
};

export default SadieReviewTicket;



