export type CookbookAssetStatus = "draft" | "in_review" | "approved" | "archived";
export type CookbookReviewState = "not_requested" | "ready" | "changes_requested" | "approved";

export interface CookbookAsset {
  id: string;
  tenant_id: string;
  title: string;
  asset_type: "web_page";
  status: CookbookAssetStatus;
  review_state: CookbookReviewState;
  current_version_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface CookbookAssetFile {
  id: string;
  tenant_id: string;
  asset_id: string;
  path: string;
  content: string;
  mime_type: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface CookbookAssetMessage {
  id: string;
  asset_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface CookbookAssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  file_snapshot: Array<{ path: string; content: string; mime_type: string }>;
  change_summary: string | null;
  provenance: { generator?: string };
  created_by: string;
  created_at: string;
}

export interface CookbookAssetWorkspace {
  files: CookbookAssetFile[];
  messages: CookbookAssetMessage[];
  versions: CookbookAssetVersion[];
}
