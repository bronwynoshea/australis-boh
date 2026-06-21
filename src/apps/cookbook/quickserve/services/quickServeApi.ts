import type {
  QuickServeDraftRequest,
  QuickServeDraftResponse,
} from "../types/quickServe";

export const generateQuickServeDraft = async (
  _request: QuickServeDraftRequest,
): Promise<QuickServeDraftResponse> => {
  return Promise.resolve({
    id: "draft-1",
    content:
      "This is a mocked QuickServe draft. In the next phase, Supabase and Gemini Live will generate real content.",
    createdAt: new Date().toISOString(),
  });
};
