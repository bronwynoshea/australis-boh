// Sadie conversation hooks and state management

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SadieMessage, SadieSlots, SadieMode, SadieSessionResponse, SadiePillOption } from './SadieTypes';
import { sendToSadieSession } from './SadieApi';

const INITIAL_SADIE_MESSAGE_CONTENT = "Hi, I'm Sadie. Tell me briefly what's going on and I'll help you create a ticket. If you'd like to use voice, click the microphone below. If you prefer to type, just use the chat box or switch to text input.";

export interface UseSadieConversationReturn {
  messages: SadieMessage[];
  slots: SadieSlots;
  missingFields: string[];
  readyForReview: boolean;
  mode: SadieMode;
  expectingStructuredInput: boolean;
  structuredInputType?: 'app' | 'feature' | 'function' | 'category' | 'severity';
  structuredInputOptions: SadiePillOption[];
  isLoading: boolean;
  isThinking: boolean;
  isListening: boolean;
  aiSessionId: string | null;
  error: string | null;
  addUserMessage: (content: string) => Promise<void>;
  processAssistantResponse: (response: SadieSessionResponse) => void;
  updateSlot: (key: keyof SadieSlots, value: string) => void;
  setMode: (mode: SadieMode) => void;
  setIsListening: (listening: boolean) => void;
  initializeConversation: () => Promise<void>;
  reset: () => void;
  onMessageSent: (handler: () => void) => void; // Set callback for when message is successfully sent
}

export function useSadieConversation(initialMode: SadieMode = 'voice'): UseSadieConversationReturn {
  const [messages, setMessages] = useState<SadieMessage[]>([]);
  const [slots, setSlots] = useState<SadieSlots>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [readyForReview, setReadyForReview] = useState(false);
  const [mode, setMode] = useState<SadieMode>(initialMode);
  const [expectingStructuredInput, setExpectingStructuredInput] = useState(false);
  const [structuredInputType, setStructuredInputType] = useState<'app' | 'feature' | 'function' | 'category' | 'severity' | undefined>();
  const [structuredInputOptions, setStructuredInputOptions] = useState<SadiePillOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);

  // Use refs to track latest state values for callbacks
  const messagesRef = useRef<SadieMessage[]>([]);
  const slotsRef = useRef<SadieSlots>({});
  const expectingStructuredInputRef = useRef(false);
  const hasInitialMessage = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    expectingStructuredInputRef.current = expectingStructuredInput;
  }, [expectingStructuredInput]);

  const processAssistantResponse = useCallback((response: SadieSessionResponse, onSuccess?: () => void) => {
    // Stop thinking when response is received
    setIsThinking(false);
    
    if (response.assistant_message) {
      const assistantMessage: SadieMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.assistant_message,
        timestamp: new Date(),
      };
      setMessages(prev => {
        // Check if this is the initial greeting and if we already have it
        const isInitialGreeting = response.assistant_message === INITIAL_SADIE_MESSAGE_CONTENT;
        if (isInitialGreeting) {
          const alreadyHas = prev.some(
            m => m.role === 'assistant' && m.content === INITIAL_SADIE_MESSAGE_CONTENT
          );
          if (alreadyHas) {
            return prev; // Don't add duplicate initial greeting
          }
          hasInitialMessage.current = true;
        }
        return [...prev, assistantMessage];
      });
    }

    // Update slots with slots / updated_slots from response (supporting both schemas)
    const nextSlots = response.slots || response.updated_slots || {};
    setSlots(nextSlots);

    // Update missing fields and review status
    setMissingFields(response.missing_fields || []);
    setReadyForReview(response.ready_for_review || false);

    // Capture AI session id if provided
    if (typeof response.ai_session_id === 'string') {
      setAiSessionId(response.ai_session_id);
    }

    // Handle structured input (if still used)
    if (response.expecting_structured_input && response.structured_input_type) {
      setExpectingStructuredInput(true);
      setStructuredInputType(response.structured_input_type);
      setStructuredInputOptions(response.structured_input_options || []);
    } else {
      setExpectingStructuredInput(false);
      setStructuredInputType(undefined);
      setStructuredInputOptions([]);
    }

    // Call success callback if provided (for clearing draft)
    if (onSuccess) {
      onSuccess();
    }
  }, []);

  // Callback ref for success handler (for clearing draft)
  const onMessageSentRef = useRef<(() => void) | null>(null);
  
  const setOnMessageSent = useCallback((handler: () => void) => {
    onMessageSentRef.current = handler;
  }, []);

  // Unified function for sending user messages (used by both text and voice)
  const sendUserMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: SadieMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    
    setIsLoading(true);
    setIsThinking(true);
    setError(null);

    try {
      // Get current slots and messages from refs
      const currentSlots = slotsRef.current;
      const currentMessages = [...messagesRef.current, userMessage];
      
      // Add user message to UI first
      setMessages(currentMessages);
      
      const response = await sendToSadieSession(currentMessages, currentSlots);
      
      // On success: process response and clear draft
      processAssistantResponse(response, () => {
        // Clear draft on successful send
        if (onMessageSentRef.current) {
          onMessageSentRef.current();
        }
      });
    } catch (err) {
      // On error: remove the user message and set error state
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to communicate with Sadie';
      setError(errorMessage);
      setIsThinking(false);
      console.error('Error in sendUserMessage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processAssistantResponse]);

  // Alias for backward compatibility - both text and voice use the same function
  const addUserMessage = sendUserMessage;

  const updateSlot = useCallback((key: keyof SadieSlots, value: string) => {
    setSlots(prev => {
      const updated = { ...prev, [key]: value };
      
      // After updating a slot, if we're expecting structured input, send it to Sadie
      if (expectingStructuredInputRef.current) {
        setIsLoading(true);
        setIsThinking(true);
        setError(null);
        
        // Create a synthetic user message representing the selection
        const syntheticMessage: SadieMessage = {
          id: `user-slot-${Date.now()}`,
          role: 'user',
          content: `Selected: ${value}`,
          timestamp: new Date(),
        };

        // Use refs to get latest values
        const currentMessages = [...messagesRef.current, syntheticMessage];
        
        sendToSadieSession(currentMessages, updated)
          .then(response => {
            processAssistantResponse(response);
          })
          .catch(err => {
            const errorMessage = err instanceof Error ? err.message : 'Failed to communicate with Sadie';
            setError(errorMessage);
            setIsThinking(false);
            console.error('Error in updateSlot:', err);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
      
      return updated;
    });
  }, [processAssistantResponse]);

  const initializeConversation = useCallback(async () => {
    // Prevent duplicate initialization using ref
    if (hasInitialMessage.current) return;
    
    // Mark as initialized immediately to prevent race conditions
    hasInitialMessage.current = true;
    
    setIsLoading(true);
    setIsThinking(true);
    setError(null);
    
    try {
      const response = await sendToSadieSession([], {});
      processAssistantResponse(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize conversation with Sadie';
      setError(errorMessage);
      setIsThinking(false);
      // Reset the flag on error so user can retry
      hasInitialMessage.current = false;
      console.error('Error initializing conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processAssistantResponse]);

  const reset = useCallback(() => {
    setMessages([]);
    setSlots({});
    setMissingFields([]);
    setReadyForReview(false);
    setExpectingStructuredInput(false);
    setStructuredInputType(undefined);
    setStructuredInputOptions([]);
    setError(null);
    setIsLoading(false);
    setIsThinking(false);
    setIsListening(false);
    setAiSessionId(null);
    hasInitialMessage.current = false;
  }, []);

  return {
    messages,
    slots,
    missingFields,
    readyForReview,
    mode,
    expectingStructuredInput,
    structuredInputType,
    structuredInputOptions,
    isLoading,
    isThinking,
    isListening,
    aiSessionId,
    error,
    addUserMessage,
    processAssistantResponse,
    updateSlot,
    setMode,
    setIsListening,
    initializeConversation,
    reset,
    onMessageSent: setOnMessageSent,
  };
}

