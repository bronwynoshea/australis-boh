import { callEdgeFunction } from './supabaseApi';

// Ensure the API key is strictly sourced from process.env.API_KEY as per guidelines.

export interface SuggestionResult {
  title: string;
  description: string;
  tags: string[];
}

export const suggestLoftRoomTitleAndDescription = async (prompt: string): Promise<SuggestionResult> => {
  return callEdgeFunction<SuggestionResult>('loft-sadie-room-create', { prompt });
};

export const getLoftRoomSummary = async (transcript: string): Promise<string> => {
  return callEdgeFunction<string>('loft-get-room-summary', { transcript });
}