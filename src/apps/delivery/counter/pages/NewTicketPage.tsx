// New Ticket Page with Sadie AI intake system

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import SadieLauncher from '../components/sadie/SadieLauncher';
import SadiePanel from '../components/sadie/SadiePanel';
import SadieReviewScreen from '../components/sadie/SadieReviewScreen';
import type { SadieSlots } from '../components/sadie/SadieTypes';

type ViewState = 'launcher' | 'sadie' | 'review' | 'confirmation';

const NewTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>('launcher');
  const [draftSlots, setDraftSlots] = useState<SadieSlots | null>(null);
  const [sadieMode, setSadieMode] = useState<'voice' | 'type'>('voice');
  const [draftAiSessionId, setDraftAiSessionId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUserEmail = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user && isMounted) {
          setCurrentUserEmail(data.user.email ?? null);
        }
      } catch (err) {
        console.error('Error loading current user for Sadie ticket:', err);
      }
    };

    loadUserEmail();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartVoice = () => {
    setSadieMode('voice');
    setViewState('sadie');
  };

  const handleStartType = () => {
    setSadieMode('type');
    setViewState('sadie');
  };

  const handleSadieComplete = (slots: SadieSlots, aiSessionId: string | null) => {
    setDraftSlots(slots);
    setDraftAiSessionId(aiSessionId ?? null);
    setViewState('review');
  };

  const handleSadieBack = () => {
    setViewState('launcher');
    setDraftSlots(null);
  };

  const handleReviewBack = () => {
    setViewState('sadie');
  };

  const checkSimilarIssues = async (slots: SadieSlots): Promise<{ existingIssue: boolean }> => {
    // Placeholder: This will be replaced by the real embeddings-based Edge Function later
    console.log('Checking for similar issues:', slots);
    
    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ existingIssue: false });
      }, 1000);
    });
  };

  const submitTicket = async (slots: SadieSlots) => {
    if (!slots?.title || !slots?.description) {
      // Minimal guard – the edge function will also validate
      console.warn('Sadie submitTicket: missing title or description');
      return;
    }

    try {
      setSubmitError(null);

      const slotsWithEmail: SadieSlots = {
        ...slots,
        // If we have an authenticated user email, prefer that over anything in slots
        requesterEmail: currentUserEmail ?? slots.requesterEmail ?? null,
      };

      // Ensure severity is always set to a valid internal key.
      // Sadie may omit it, and the review UI can show "Not specified".
      const rawSeverity = (slotsWithEmail as any)?.severity;
      const severityStr = rawSeverity?.toString?.().trim?.() || '';
      const normalizedSeverity = severityStr.toLowerCase();
      (slotsWithEmail as any).severity = ['critical', 'high', 'medium', 'low'].includes(normalizedSeverity)
        ? normalizedSeverity
        : 'medium';

      const { data, error } = await supabase.functions.invoke<any>('sadie-create-ticket', {
        body: {
          slots: slotsWithEmail,
          ai_session_id: draftAiSessionId ?? null,
        },
      });

      // Edge Function errors surface either in the top-level `error` or
      // in the JSON body as { error: true, message, details }
      if (error || data?.error) {
        console.error('Error creating ticket via sadie-create-ticket:', error || data);
        let messageFromBody = typeof data?.message === 'string' ? data.message : null;

        // Supabase functions.invoke may return a generic message for non-2xx.
        // Try to extract the JSON body from the underlying Response when available.
        if (!messageFromBody && error && typeof (error as any)?.context?.text === 'function') {
          try {
            const rawText = await (error as any).context.text();
            try {
              const parsed = JSON.parse(rawText);
              if (typeof parsed?.message === 'string') {
                messageFromBody = parsed.message;
              }
            } catch {
              // If not JSON, just use raw text if it looks helpful.
              if (rawText && rawText.trim().length > 0) {
                messageFromBody = rawText.trim();
              }
            }
          } catch {
            // ignore
          }
        }
        const fallbackMessage = 'We couldn\'t create your ticket just now. Please try again in a moment.';
        setSubmitError(messageFromBody || error?.message || fallbackMessage);
        return;
      }

      // Edge function returns { ticketId, ticketNumber }
      const ticketId = data?.ticketId;

      // Navigate to ticket detail if we have an ID; otherwise go to inbox
      if (ticketId) {
        navigate(`/counter/tickets/${ticketId}`);
      } else {
        navigate('/counter/inbox');
      }

      // Clear local draft state
      setDraftSlots(null);
      setDraftAiSessionId(null);
      setViewState('confirmation');
    } catch (err) {
      console.error('Unexpected error in submitTicket:', err);
      setSubmitError('We couldn\'t create your ticket just now. Please try again in a moment.');
    }
  };

  const handleConfirmationClose = () => {
    navigate('/counter/dashboard');
  };

  // Launcher View
  if (viewState === 'launcher') {
    return (
      <div className="flex-1 overflow-y-auto boh-hide-scrollbars">
        <SadieLauncher
          onStartVoice={handleStartVoice}
          onStartType={handleStartType}
        />
      </div>
    );
  }

  // Confirmation View
  if (viewState === 'confirmation') {
    return (
      <div className="flex-1 overflow-y-auto boh-hide-scrollbars bg-boh-bg-light dark:bg-boh-bg">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-sm p-8 text-center space-y-6">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-boh-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-boh-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
                Your ticket has been submitted.
              </h1>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                We'll review your ticket and get back to you soon.
              </p>
            </div>
            
            <button
              onClick={handleConfirmationClose}
              className="px-6 py-3 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sadie Panel View
  if (viewState === 'sadie') {
    return (
      <SadiePanel
        initialMode={sadieMode}
        onComplete={handleSadieComplete}
        onBack={handleSadieBack}
      />
    );
  }

  // Review View
  if (viewState === 'review' && draftSlots) {
    return (
      <SadieReviewScreen
        slots={draftSlots}
        onBack={handleReviewBack}
        onCheckSimilar={checkSimilarIssues}
        onSubmit={submitTicket}
        submitError={submitError}
      />
    );
  }

  return null;
};

export default NewTicketPage;
