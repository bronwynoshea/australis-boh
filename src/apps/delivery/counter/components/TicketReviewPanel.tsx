import React, { useState } from 'react';
import type { SadieSlotValues } from './SadieIntakePanel';
import PillGroup, { type PillOption } from './PillGroup';
import { APP_FEATURE_GROUPS, CATEGORY_OPTIONS } from '../constants';

interface TicketReviewPanelProps {
  draftTicket: SadieSlotValues;
  onBack: () => void;
  onCheckSimilar: (draft: SadieSlotValues) => Promise<{ existingIssue: boolean }>;
  onSubmit: (draft: SadieSlotValues) => void;
}

// Severity options with user-friendly labels
const SADIE_SEVERITY_OPTIONS: PillOption[] = [
  { value: 'critical', label: 'Completely blocked', description: "I can't work — this is blocking me completely." },
  { value: 'high', label: 'Major inconvenience', description: "This is stopping me from doing part of my work." },
  { value: 'medium', label: 'Minor inconvenience', description: "It's inconvenient or slowing me down." },
  { value: 'low', label: 'Nice to have', description: "It's a small annoyance or nice-to-fix." },
];

const TicketReviewPanel: React.FC<TicketReviewPanelProps> = ({
  draftTicket,
  onBack,
  onCheckSimilar,
  onSubmit
}) => {
  const [editedTicket, setEditedTicket] = useState<SadieSlotValues>(draftTicket);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);
  const [similarCheckResult, setSimilarCheckResult] = useState<{ existingIssue: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appLabel = APP_FEATURE_GROUPS.find(g => g.appKey === editedTicket.app)?.appLabel || editedTicket.app;
  const featureLabel = APP_FEATURE_GROUPS
    .find(g => g.appKey === editedTicket.app)
    ?.features.find(f => f.key === editedTicket.feature)?.label || editedTicket.feature;

  const categoryOptions: PillOption[] = CATEGORY_OPTIONS.map(c => ({
    value: c.value,
    label: c.label
  }));

  const handleCheckSimilar = async () => {
    setIsCheckingSimilar(true);
    setSimilarCheckResult(null);
    
    try {
      const result = await onCheckSimilar(editedTicket);
      setSimilarCheckResult(result);
    } catch (error) {
      console.error('Error checking for similar issues:', error);
      setSimilarCheckResult({ existingIssue: false });
    } finally {
      setIsCheckingSimilar(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(editedTicket);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = editedTicket.app && editedTicket.feature && editedTicket.description && 
                     editedTicket.severity && editedTicket.category && editedTicket.title;

  return (
    <div className="flex flex-col h-full bg-boh-bg-light dark:bg-boh-bg overflow-y-auto boh-hide-scrollbars">
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
              Review Your Ticket
            </h1>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Review and edit your ticket before submitting
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
          >
            Back to Sadie
          </button>
        </div>

        {/* Review Card */}
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-sm p-6 space-y-6">
          {/* Title - Editable */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Ticket Title
            </label>
            <input
              type="text"
              value={editedTicket.title}
              onChange={(e) => setEditedTicket({ ...editedTicket, title: e.target.value })}
              className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
              placeholder="Enter ticket title"
            />
          </div>

          {/* App - Locked */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              App <span className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">(locked)</span>
            </label>
            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
              {appLabel}
            </div>
          </div>

          {/* Feature - Locked */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Feature <span className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">(locked)</span>
            </label>
            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
              {featureLabel}
            </div>
          </div>

          {/* Category - Editable */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Category
            </label>
            <PillGroup
              name="category"
              options={categoryOptions}
              value={editedTicket.category}
              onChange={(value) => setEditedTicket({ ...editedTicket, category: value })}
              ariaLabel="Select category"
            />
          </div>

          {/* Severity - Editable */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Severity
            </label>
            <PillGroup
              name="severity"
              options={SADIE_SEVERITY_OPTIONS}
              value={editedTicket.severity}
              onChange={(value) => setEditedTicket({ ...editedTicket, severity: value })}
              ariaLabel="Select severity"
            />
            {editedTicket.severity && (
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-2">
                {SADIE_SEVERITY_OPTIONS.find(s => s.value === editedTicket.severity)?.description}
              </p>
            )}
          </div>

          {/* Description - Editable */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Description
            </label>
            <textarea
              value={editedTicket.description}
              onChange={(e) => setEditedTicket({ ...editedTicket, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary resize-none"
              placeholder="Describe the issue..."
            />
          </div>
        </div>

        {/* Similar Check Result */}
        {similarCheckResult && (
          <div className={`p-4 rounded-lg border ${
            similarCheckResult.existingIssue
              ? 'bg-boh-primary/10 border-boh-primary text-boh-text-light dark:text-boh-text'
              : 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text'
          }`}>
            <p className="text-sm font-medium">
              {similarCheckResult.existingIssue
                ? "Thanks — this issue is known. We've linked your report so you'll receive updates."
                : "This looks like a new issue. Ready to submit?"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-sm hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
          >
            Back to Sadie
          </button>
          <button
            onClick={handleCheckSimilar}
            disabled={!isComplete || isCheckingSimilar || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCheckingSimilar ? 'Checking...' : 'Check for similar issues'}
          </button>
          {similarCheckResult && !similarCheckResult.existingIssue && (
            <button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketReviewPanel;

