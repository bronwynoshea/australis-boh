export interface ContentProject {
  id: string;

  // Schema fields from content_projects
  title: string;
  subtitle: string | null;
  content_type: string;
  reference_md?: string | null;
  soundbyte_id?: string | null;
  outline?: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
  meta?: Record<string, unknown> | null;
  interviewer_prompt?: string | null;
}

export interface ContentSection {
  id: string;
  project_id: string;

  // Schema fields from content_sections
  label: string;
  section_index: number;
  section_type: string | null;
  notes: string | null;
  status: string;
  interview_completed?: boolean;
  raw_md?: string | null;
  draft_md?: string | null;
  final_md?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentExchange {
  id: string;
  project_id: string;
  section_id: string | null;
  sequence: number;
  role: string;
  question_text: string | null;
  answer_text: string | null;
  created_at: string;
}