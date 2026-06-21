import React, { useState, useEffect, useRef } from 'react';
import type { PillOption } from './PillGroup';
import PillGroup from './PillGroup';
import { APP_FEATURE_GROUPS, CATEGORY_OPTIONS, SEVERITY_OPTIONS } from '../constants';

export interface SadieSlotValues {
  app: string | null;
  feature: string | null;
  function: string | null;
  category: string | null;
  severity: string | null;
  description: string;
  title: string;
}

interface SadieMessage {
  type: 'sadie' | 'user';
  content: string;
  timestamp: Date;
}

interface SadieIntakePanelProps {
  onComplete: (slots: SadieSlotValues) => void;
  onBack: () => void;
  useTextFallback?: boolean;
}

// Severity options with user-friendly labels
const SADIE_SEVERITY_OPTIONS: PillOption[] = [
  { 
    value: 'critical', 
    label: 'Completely blocked',
    description: "I can't work — this is blocking me completely."
  },
  { 
    value: 'high', 
    label: 'Major inconvenience',
    description: "This is stopping me from doing part of my work."
  },
  { 
    value: 'medium', 
    label: 'Minor inconvenience',
    description: "It's inconvenient or slowing me down."
  },
  { 
    value: 'low', 
    label: 'Nice to have',
    description: "It's a small annoyance or nice-to-fix."
  },
];

const SadieIntakePanel: React.FC<SadieIntakePanelProps> = ({ 
  onComplete, 
  onBack,
  useTextFallback = false 
}) => {
  const [slots, setSlots] = useState<SadieSlotValues>({
    app: null,
    feature: null,
    function: null,
    category: null,
    severity: null,
    description: '',
    title: '',
  });
  
  const [messages, setMessages] = useState<SadieMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'app' | 'feature' | 'function' | 'description' | 'severity' | 'category' | 'extra'>('app');
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize with Sadie's greeting
  useEffect(() => {
    const greeting: SadieMessage = {
      type: 'sadie',
      content: "Hi! I'm Sadie, and I'm here to help you create a support ticket. Let's start by understanding which app you were using when the issue occurred.",
      timestamp: new Date()
    };
    setMessages([greeting]);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get available features for selected app
  const availableFeatures = slots.app 
    ? APP_FEATURE_GROUPS.find(g => g.appKey === slots.app)?.features || []
    : [];

  // Get available functions for selected feature
  // In a real implementation, this would come from a database or config
  const availableFunctions = slots.feature 
    ? [
        { key: 'general', label: 'General' },
        { key: 'login', label: 'Login/Authentication' },
        { key: 'data', label: 'Data/Content' },
        { key: 'navigation', label: 'Navigation' },
        { key: 'performance', label: 'Performance' },
        { key: 'other', label: 'Other' }
      ]
    : [];

  const addSadieMessage = (content: string) => {
    setMessages(prev => [...prev, {
      type: 'sadie',
      content,
      timestamp: new Date()
    }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      type: 'user',
      content,
      timestamp: new Date()
    }]);
  };

  const handleAppSelect = (value: string) => {
    const newSlots = { ...slots, app: value, feature: null, function: null };
    setSlots(newSlots);
    addUserMessage(`App: ${APP_FEATURE_GROUPS.find(g => g.appKey === value)?.appLabel || value}`);
    addSadieMessage(`Great! Now, which feature within ${APP_FEATURE_GROUPS.find(g => g.appKey === value)?.appLabel} were you using?`);
    setCurrentStep('feature');
  };

  const handleFeatureSelect = (value: string) => {
    const featureLabel = availableFeatures.find(f => f.key === value)?.label || value;
    const newSlots = { ...slots, feature: value, function: null };
    setSlots(newSlots);
    addUserMessage(`Feature: ${featureLabel}`);
    addSadieMessage(`Got it. Which function or area within ${featureLabel}?`);
    setCurrentStep('function');
  };

  const handleFunctionSelect = (value: string) => {
    const functionLabel = availableFunctions.find(f => f.key === value)?.label || value;
    const newSlots = { ...slots, function: value };
    setSlots(newSlots);
    addUserMessage(`Function: ${functionLabel}`);
    addSadieMessage("Now, please describe what happened. You can speak or type your response.");
    setCurrentStep('description');
    // Auto-focus text input or show recording button
  };

  const handleDescriptionSubmit = () => {
    if (!textInput.trim() && !isRecording) return;
    
    const description = textInput.trim();
    if (description) {
      // Generate title from first sentence or first 100 chars
      const title = description.split(/[.!?]/)[0].trim() || description.substring(0, 100).trim();
      const newSlots = { ...slots, description, title: title || 'Support Request' };
      setSlots(newSlots);
      addUserMessage(description);
      addSadieMessage("Thanks! How severe is this issue for you?");
      setCurrentStep('severity');
      setTextInput('');
    }
  };

  const handleSeveritySelect = (value: string) => {
    const severityLabel = SADIE_SEVERITY_OPTIONS.find(s => s.value === value)?.label || value;
    const newSlots = { ...slots, severity: value };
    setSlots(newSlots);
    addUserMessage(`Severity: ${severityLabel}`);
    addSadieMessage("What category best describes this issue?");
    setCurrentStep('category');
  };

  const handleCategorySelect = (value: string) => {
    const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === value)?.label || value;
    const newSlots = { ...slots, category: value };
    setSlots(newSlots);
    addUserMessage(`Category: ${categoryLabel}`);
    addSadieMessage("Is there anything else you'd like to add?");
    setCurrentStep('extra');
  };

  const handleExtraSubmit = () => {
    let updatedSlots = { ...slots };
    
    if (textInput.trim()) {
      updatedSlots = { 
        ...slots, 
        description: `${slots.description}\n\nAdditional details: ${textInput}` 
      };
      setSlots(updatedSlots);
      addUserMessage(textInput);
    }
    setTextInput('');
    
    // Check if we have enough info
    if (updatedSlots.app && updatedSlots.feature && updatedSlots.description && updatedSlots.severity && updatedSlots.category) {
      addSadieMessage("Perfect! Let's review your ticket before submitting.");
      setTimeout(() => onComplete(updatedSlots), 500);
    } else {
      addSadieMessage("I need a bit more information. Let me ask again...");
      // Go back to missing step
      if (!updatedSlots.app) setCurrentStep('app');
      else if (!updatedSlots.feature) setCurrentStep('feature');
      else if (!updatedSlots.description) setCurrentStep('description');
      else if (!updatedSlots.severity) setCurrentStep('severity');
      else if (!updatedSlots.category) setCurrentStep('category');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Placeholder: In real implementation, send to Edge Function
        console.log('Audio recorded:', audioBlob.size, 'bytes');
        setIsProcessing(true);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Simulate processing - in real implementation, send blob to Edge Function
        setTimeout(() => {
          // Placeholder transcript - will be replaced with actual transcription from Edge Function
          const transcript = currentStep === 'description' 
            ? "I was trying to use the feature and it didn't work as expected."
            : "No additional details at this time.";
          setTextInput(transcript);
          setIsProcessing(false);
        }, 1500);
      };

      mediaRecorder.start();
      setIsRecording(true);
      addUserMessage("🎤 Recording...");
    } catch (error) {
      console.error('Error accessing microphone:', error);
      addSadieMessage("I couldn't access your microphone. Please type your response instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 'description') {
      handleDescriptionSubmit();
    } else if (currentStep === 'extra') {
      handleExtraSubmit();
    }
  };

  const appOptions: PillOption[] = APP_FEATURE_GROUPS.map(g => ({
    value: g.appKey,
    label: g.appLabel
  }));

  const featureOptions: PillOption[] = availableFeatures.map(f => ({
    value: f.key,
    label: f.label
  }));

  const functionOptions: PillOption[] = availableFunctions.map(f => ({
    value: f.key,
    label: f.label
  }));

  const categoryOptions: PillOption[] = CATEGORY_OPTIONS.map(c => ({
    value: c.value,
    label: c.label
  }));

  return (
    <div className="flex flex-col h-full bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Sadie</h2>
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">AI Ticket Assistant</p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
        >
          Back
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto boh-hide-scrollbars px-4 sm:px-6 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.type === 'user'
                  ? 'bg-boh-primary text-white'
                  : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text border border-boh-border-light dark:border-boh-border'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {/* Current step UI */}
        {currentStep === 'app' && (
          <div className="space-y-3">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Which app were you using?</p>
            <PillGroup
              name="app"
              options={appOptions}
              value={slots.app}
              onChange={handleAppSelect}
              ariaLabel="Select an app"
            />
          </div>
        )}

        {currentStep === 'feature' && slots.app && (
          <div className="space-y-3">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Which feature?</p>
            <PillGroup
              name="feature"
              options={featureOptions}
              value={slots.feature}
              onChange={handleFeatureSelect}
              ariaLabel="Select a feature"
            />
          </div>
        )}

        {currentStep === 'function' && slots.feature && (
          <div className="space-y-3">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Which function or area within {availableFeatures.find(f => f.key === slots.feature)?.label}?</p>
            <PillGroup
              name="function"
              options={functionOptions}
              value={slots.function}
              onChange={handleFunctionSelect}
              ariaLabel="Select a function"
            />
          </div>
        )}

        {currentStep === 'severity' && (
          <div className="space-y-3">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">How severe is this issue?</p>
            <PillGroup
              name="severity"
              options={SADIE_SEVERITY_OPTIONS}
              value={slots.severity}
              onChange={handleSeveritySelect}
              ariaLabel="Select severity"
            />
            {slots.severity && (
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-2">
                {SADIE_SEVERITY_OPTIONS.find(s => s.value === slots.severity)?.description}
              </p>
            )}
          </div>
        )}

        {currentStep === 'category' && (
          <div className="space-y-3">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">What category?</p>
            <PillGroup
              name="category"
              options={categoryOptions}
              value={slots.category}
              onChange={handleCategorySelect}
              ariaLabel="Select category"
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 sm:px-6 py-4">
        {(currentStep === 'description' || currentStep === 'extra') && (
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={currentStep === 'description' ? "Describe what happened..." : "Any additional details?"}
              className="flex-1 px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
              disabled={isProcessing || isRecording}
              aria-label={currentStep === 'description' ? "Describe what happened" : "Additional details"}
            />
            {!useTextFallback && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 ${
                  isRecording
                    ? 'bg-boh-primary text-white hover:opacity-90 animate-pulse'
                    : 'bg-boh-primary text-white hover:opacity-90'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? '⏹ Stop' : isProcessing ? '⏳ Processing...' : '🎤 Record'}
              </button>
            )}
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing || isRecording}
              className="px-4 py-2 bg-boh-primary text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SadieIntakePanel;

