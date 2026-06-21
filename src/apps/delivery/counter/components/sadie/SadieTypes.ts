// Sadie type definitions

export interface SadieMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SadieSlots {
  app?: string | null;
  feature?: string | null;
  function?: string | null;
  category?: "Bug" | "Feature idea" | "Question" | "Account issue" | "Other" | null;
  severity?: "Critical" | "High" | "Medium" | "Low" | null;
  title?: string | null;
  description?: string | null;
  requesterEmail?: string | null;
}

export interface SadieSessionResponse {
  assistant_message: string;
  // New schema from edge function: slots + ai_session_id
  slots?: SadieSlots;
  ai_session_id?: string | null;
  // Backward-compatible field name used by the previous version
  updated_slots?: SadieSlots;
  missing_fields: string[];
  ready_for_review: boolean;
  expecting_structured_input?: boolean;
  structured_input_type?: 'app' | 'feature' | 'function' | 'category' | 'severity';
  structured_input_options?: Array<{ value: string; label: string }>;
}

export interface SadieTranscribeResponse {
  transcript: string;
  confidence?: number;
}

export type SadieMode = 'voice' | 'type';

export interface SadiePillOption {
  value: string;
  label: string;
}
