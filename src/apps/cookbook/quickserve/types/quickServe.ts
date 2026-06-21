export type QuickServeFormat =
  | "LinkedIn Post"
  | "Meme Caption"
  | "Short Video Script"
  | "Email Snippet";

export interface QuickServeDraftRequest {
  soundbyteId: string;
  personaId: string;
  format: QuickServeFormat;
  brief: string;
}

export interface QuickServeDraftResponse {
  id: string;
  content: string;
  createdAt: string;
}
