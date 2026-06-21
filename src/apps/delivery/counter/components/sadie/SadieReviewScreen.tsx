// Review screen for Sadie ticket intake

import React, { useState } from 'react';
import type { SadieSlots } from './SadieTypes';
import { APP_FEATURE_GROUPS, SEVERITY_OPTIONS, getSeverityLabel } from '../../constants';
import { TicketSeverity } from '../../types';

interface SadieReviewScreenProps {
  slots: SadieSlots;
  onBack: () => void;
  onCheckSimilar: (slots: SadieSlots) => Promise<{ existingIssue: boolean }>;
  onSubmit: (slots: SadieSlots) => Promise<void>;
  submitError?: string | null;
}

const SadieReviewScreen: React.FC<SadieReviewScreenProps> = ({
  slots,
  onBack,
  onCheckSimilar,
  onSubmit,
  submitError,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlots, setEditedSlots] = useState<SadieSlots>(() => {
    const raw = (slots as any)?.severity;
    const severityStr = raw?.toString?.().trim?.() || '';
    const normalized = severityStr.toLowerCase();
    const safeSeverity = ['critical', 'high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
    return {
      ...slots,
      severity: safeSeverity,
    } as SadieSlots;
  });
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);
  const [similarCheckResult, setSimilarCheckResult] = useState<{ existingIssue: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get labels for app, feature, and function
  const appGroup = APP_FEATURE_GROUPS.find(g => g.appKey === slots.app);
  const appLabel = appGroup?.appLabel || slots.app || 'Not set';
  const feature = appGroup?.features.find(f => f.key === slots.feature);
  const featureLabel = feature?.label || slots.feature || 'Not set';
  const functionLabel = slots.function || 'Not set';

  const severityValue = (editedSlots.severity || 'medium')?.toString?.().trim?.().toLowerCase?.() || 'medium';
  const severityKey = (['critical', 'high', 'medium', 'low'].includes(severityValue)
    ? severityValue
    : 'medium') as TicketSeverity;
  const severityLabel = getSeverityLabel(severityKey);
  
  // Get category label (read-only, auto-detected) - replace "Bug" with "Issue"
  const categoryLabel = slots.category 
    ? slots.category === 'Bug' ? 'Issue' : slots.category
    : 'Auto-detected';

  const handleCheckSimilar = async () => {
    setIsCheckingSimilar(true);
    setSimilarCheckResult(null);
    
    try {
      const result = await onCheckSimilar(editedSlots);
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
      await onSubmit(editedSlots);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasText = (value?: string | null) =>
    typeof value === 'string' && value.trim().length > 0;

  const isComplete = Boolean(
    editedSlots.app &&
    hasText(editedSlots.title) &&
    hasText(editedSlots.description) &&
    hasText(editedSlots.severity as string | null)
  );

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    // Edited slots are already in state, ready for submission
  };

  return (
    <div className="fixed inset-0 bg-boh-bg-light dark:bg-boh-bg flex flex-col h-full z-50 overflow-y-auto boh-hide-scrollbars px-4 sm:px-6">
      <div className="max-w-xl mx-auto w-full py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
              Review Your Ticket
            </h1>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Review your ticket before submitting
            </p>
          </div>
          <button
            onClick={onBack}
            className="p-2 text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Review Card */}
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-2xl shadow-lg p-6 space-y-6">
          {/* Title - Read-only */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Ticket Title
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedSlots.title || ''}
                onChange={(e) => setEditedSlots({ ...editedSlots, title: e.target.value })}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                placeholder="Enter ticket title"
              />
            ) : (
              <p className="text-sm text-boh-text-light dark:text-boh-text px-4 py-2 bg-boh-bg-light/50 dark:bg-boh-bg/50 rounded-lg">
                {editedSlots.title || 'No title provided'}
              </p>
            )}
          </div>

          {/* Description - Read-only */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Description
            </label>
            {isEditing ? (
              <textarea
                value={editedSlots.description || ''}
                onChange={(e) => setEditedSlots({ ...editedSlots, description: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary resize-none"
                placeholder="Describe the issue..."
              />
            ) : (
              <p className="text-sm text-boh-text-light dark:text-boh-text whitespace-pre-wrap px-4 py-2 bg-boh-bg-light/50 dark:bg-boh-bg/50 rounded-lg min-h-[120px]">
                {editedSlots.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* App - Static */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              App <span className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">(locked)</span>
            </label>
            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
              {appLabel}
            </div>
          </div>

          {/* Feature - Static */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Feature <span className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">(locked)</span>
            </label>
            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
              {featureLabel}
            </div>
          </div>

          {/* Function - Static (if present) */}
          {editedSlots.function && (
            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                Function <span className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">(locked)</span>
              </label>
              <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
                {functionLabel}
              </div>
            </div>
          )}

          {/* Severity - Read-only (only show 3 levels, exclude "Nice to have"/Low) */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Severity
            </label>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-boh-primary/10 text-boh-primary border border-boh-primary">
                {severityLabel}
              </div>
            </div>
          </div>

          {/* Issue Type - Read-only (auto-detected, hidden from user) */}
          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
              Issue Type
            </label>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {categoryLabel} (auto-detected)
            </p>
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

        {/* Submission Error */}
        {submitError && (
          <div className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-100">
            <p className="text-sm font-medium">
              {submitError}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          {!isEditing ? (
            <>
              <button
                onClick={handleEdit}
                className="px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-sm hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
              >
                Edit Ticket
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
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-sm hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 transition-colors"
              >
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SadieReviewScreen;

