import type { ContentProject, ContentSection } from "../../../types/content";

export interface ContentBlueprint extends ContentProject {}

export interface SoundbyteStrategyOption {
  id: string;
  name: string;
}

export interface HarperQuestion {
  id: string;
  text: string;
  sectionId: string;
}

export interface HarperConversationState {
  projectId: string;
  soundbyteId: string;
  activeSectionId: string | null;
  currentQuestion: HarperQuestion | null;
  sections: ContentSection[];
}

export interface ContentDraft {
  id: string;
  blueprintId: string;
  sectionId: string | null;
  version: number;
  status: "draft" | "ready_for_review" | "final";
  source: "raw" | "ai_polished" | "manual_edit" | "imported";
  title: string | null;
  contentMd: string;
  isCurrent: boolean;
  createdAt: string;
}
