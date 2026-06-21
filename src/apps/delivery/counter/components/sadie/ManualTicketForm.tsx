import React, { useEffect, useMemo, useState } from 'react';
import {
  createManualTicket,
  fetchTicketLookups,
  type ManualTicketPayload,
} from '../../api/counterTicketsApi';
import type { CounterTicketPriority, CounterTicketStatus } from '../../types';
import { APP_OPTIONS, CATEGORY_OPTIONS } from '../../constants';

interface ManualTicketFormProps {
  onCancel: () => void;
  onCreated?: (ticketId: string) => void;
  initialValues?: Partial<ManualTicketPayload>;
}

interface ManualTicketFormState {
  subject: string;
  description: string;
  category: string;
  app: string;
  status_id: string;
  priority_id: string;
  requester_name: string;
  requester_email: string;
  screenshot_url: string;
}

const REQUIRED_FIELDS: Array<keyof ManualTicketFormState> = [
  'subject',
  'description',
  'category',
  'app',
  'status_id',
  'priority_id',
];

const ManualTicketForm: React.FC<ManualTicketFormProps> = ({
  onCancel,
  onCreated,
  initialValues,
}) => {
  const defaultCategory = CATEGORY_OPTIONS[0]?.value ?? 'Bug';
  const defaultApp = APP_OPTIONS[0]?.key ?? 'counter';

  const [formValues, setFormValues] = useState<ManualTicketFormState>({
    subject: initialValues?.subject ?? '',
    description: initialValues?.description ?? '',
    category: initialValues?.category ?? defaultCategory,
    app: initialValues?.app ?? defaultApp,
    status_id: initialValues?.status_id ?? '',
    priority_id: initialValues?.priority_id ?? '',
    requester_name: initialValues?.requester_name ?? '',
    requester_email: initialValues?.requester_email ?? '',
    screenshot_url: initialValues?.screenshot_url ?? '',
  });

  const [statusOptions, setStatusOptions] = useState<CounterTicketStatus[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<CounterTicketPriority[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLookups = async () => {
      setIsLoadingLookups(true);
      setLoadError(null);
      try {
        const lookups = await fetchTicketLookups();
        if (!isMounted) return;

        setStatusOptions(lookups.statuses || []);
        setPriorityOptions(lookups.priorities || []);

        setFormValues((prev) => ({
          ...prev,
          status_id: prev.status_id || lookups.statuses?.[0]?.id || '',
          priority_id: prev.priority_id || lookups.priorities?.[0]?.id || '',
        }));
      } catch (error) {
        console.error('[ManualTicketForm] Failed to load lookups', error);
        if (isMounted) {
          setLoadError('Unable to load ticket options. Please refresh and try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingLookups(false);
        }
      }
    };

    loadLookups();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialValues) {
      setFormValues((prev) => ({
        ...prev,
        subject: initialValues.subject ?? prev.subject,
        description: initialValues.description ?? prev.description,
        category: initialValues.category ?? prev.category,
        app: initialValues.app ?? prev.app,
        status_id: initialValues.status_id ?? prev.status_id,
        priority_id: initialValues.priority_id ?? prev.priority_id,
        requester_name: initialValues.requester_name ?? prev.requester_name,
        requester_email: initialValues.requester_email ?? prev.requester_email,
        screenshot_url: initialValues.screenshot_url ?? prev.screenshot_url,
      }));
    }
  }, [initialValues]);

  const isReady = useMemo(() => {
    return REQUIRED_FIELDS.every((field) => {
      const value = formValues[field];
      return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
    });
  }, [formValues]);

  const handleInputChange = (
    field: keyof ManualTicketFormState,
    value: string,
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const missingField = REQUIRED_FIELDS.find((field) => {
      const value = formValues[field];
      return !(typeof value === 'string' ? value.trim() : value);
    });

    if (missingField) {
      setSubmitError('Please complete all required fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ManualTicketPayload = {
        subject: formValues.subject,
        description: formValues.description,
        category: formValues.category,
        app: formValues.app,
        status_id: formValues.status_id,
        priority_id: formValues.priority_id,
        requester_name: formValues.requester_name.trim() || undefined,
        requester_email: formValues.requester_email.trim() || undefined,
        screenshot_url: formValues.screenshot_url.trim() || undefined,
        release_version_id: initialValues?.release_version_id,
      };

      const ticket = await createManualTicket(payload);
      if (ticket?.id) {
        if (onCreated) {
          onCreated(ticket.id);
          return;
        }
        setSuccessMessage('Ticket created successfully.');
        setFormValues((prev) => ({
          ...prev,
          subject: '',
          description: '',
          requester_name: '',
          requester_email: '',
          screenshot_url: '',
        }));
      } else {
        setSubmitError('Ticket was created but no identifier was returned.');
      }
    } catch (error) {
      console.error('[ManualTicketForm] Failed to create ticket', error);
      setSubmitError('Unable to create the ticket right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-boh-bg-light dark:bg-boh-bg flex justify-center items-stretch h-full z-50 px-4 overflow-y-auto boh-hide-scrollbars">
      <div className="flex flex-col h-full w-full max-w-2xl py-8">
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-2xl shadow-lg p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
                Create a Ticket
              </h1>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                Switch back to Sadie any time — this form creates a ticket immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text"
            >
              Cancel
            </button>
          </div>

          {loadError && (
            <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-100">
              {loadError}
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 text-sm text-green-800 dark:border-green-500 dark:bg-green-900/30 dark:text-green-100">
              {successMessage}
            </div>
          )}

          {submitError && (
            <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-500 dark:bg-red-900/30 dark:text-red-100">
              {submitError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                Subject<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formValues.subject}
                onChange={(event) => handleInputChange('subject', event.target.value)}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                placeholder="Give the ticket a short title"
                disabled={isLoadingLookups || isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                Description<span className="text-red-500">*</span>
              </label>
              <textarea
                value={formValues.description}
                onChange={(event) => handleInputChange('description', event.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary resize-none"
                placeholder="Describe the issue as clearly as you can"
                disabled={isLoadingLookups || isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Category<span className="text-red-500">*</span>
                </label>
                <select
                  value={formValues.category}
                  onChange={(event) => handleInputChange('category', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  disabled={isLoadingLookups || isSubmitting}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  App<span className="text-red-500">*</span>
                </label>
                <select
                  value={formValues.app}
                  onChange={(event) => handleInputChange('app', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  disabled={isLoadingLookups || isSubmitting}
                >
                  {APP_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Status<span className="text-red-500">*</span>
                </label>
                <select
                  value={formValues.status_id}
                  onChange={(event) => handleInputChange('status_id', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  disabled={isLoadingLookups || isSubmitting}
                >
                  {statusOptions.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Priority<span className="text-red-500">*</span>
                </label>
                <select
                  value={formValues.priority_id}
                  onChange={(event) => handleInputChange('priority_id', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  disabled={isLoadingLookups || isSubmitting}
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Requester name
                </label>
                <input
                  type="text"
                  value={formValues.requester_name}
                  onChange={(event) => handleInputChange('requester_name', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  placeholder="Who reported this?"
                  disabled={isLoadingLookups || isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Requester email
                </label>
                <input
                  type="email"
                  value={formValues.requester_email}
                  onChange={(event) => handleInputChange('requester_email', event.target.value)}
                  className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                  placeholder="name@example.com"
                  disabled={isLoadingLookups || isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                Screenshot URL
              </label>
              <input
                type="url"
                value={formValues.screenshot_url}
                onChange={(event) => handleInputChange('screenshot_url', event.target.value)}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
                placeholder="https://..."
                disabled={isLoadingLookups || isSubmitting}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4">
              <button
                type="submit"
                className="inline-flex justify-center px-4 py-2 rounded-md text-sm font-medium text-white bg-boh-primary border border-transparent shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isReady || isSubmitting || isLoadingLookups}
              >
                {isSubmitting ? 'Creating…' : 'Create ticket'}
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="inline-flex justify-center px-4 py-2 rounded-md text-sm font-medium text-boh-text-light dark:text-boh-text bg-transparent border border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                disabled={isSubmitting}
              >
                Back to Sadie
              </button>

              {!isReady && (
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  Fill out the required fields to enable submission.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualTicketForm;
