import type { ContentSection } from "../../../types/content";

export const PROJECT_TYPE_CONFIG: Record<
  string,
  {
    humanTitle: string;
    humanSubtitle: string;
    contentKind: "book" | "blog" | "landing_page";
    projectType: "book" | "long_article" | "landing_page" | "email_sequence" | "whitepaper" | "webinar_script";
  }
> = {
  books: {
    humanTitle: "Create a book",
    humanSubtitle: "Structure and draft multi-chapter book projects.",
    contentKind: "book",
    projectType: "book",
  },
  "long-articles": {
    humanTitle: "Create a long-form article",
    humanSubtitle: "Draft pillar posts and in-depth editorial articles.",
    contentKind: "blog",
    projectType: "long_article",
  },
  "landing-pages": {
    humanTitle: "Create a landing page",
    humanSubtitle: "Draft long-form sales and launch pages.",
    contentKind: "landing_page",
    projectType: "landing_page",
  },
  "email-sequences": {
    humanTitle: "Create an email sequence",
    humanSubtitle: "Build multi-email nurture and launch sequences.",
    contentKind: "blog",
    projectType: "email_sequence",
  },
  whitepapers: {
    humanTitle: "Create a whitepaper",
    humanSubtitle: "Research-driven reports and expert papers.",
    contentKind: "blog",
    projectType: "whitepaper",
  },
  webinars: {
    humanTitle: "Create a webinar or script",
    humanSubtitle: "Plan webinar outlines and scripted session content.",
    contentKind: "blog",
    projectType: "webinar_script",
  },
};

export const LAST_PROJECT_STORAGE_KEY = "cookbook_slowcook_last_project_book";
export const REFERENCE_AUTOSAVE_DELAY = 1200;
export const DEFAULT_INTERVIEWER_PROMPT = `You are Harper, the interviewer for a JOBZ CAFE® book project.

Your job:
- Ask clear, practical, chapter-specific questions that help the author produce usable chapter content.
- Ask ONE question at a time.
- If an answer is vague, ask a sharper follow-up that requests an example, proof, or a specific moment.
- Keep momentum: avoid filler (“go deeper”, “tell me more”) unless you make it specific.
- Do not use therapy/coaching language. This is professional self-reflection, not counseling.
- Stay aligned with JOBZ CAFE® tone: direct, warm, evidence-based, modern.

Always ground your question in the current chapter title and the project’s purpose.`;

export function isPart(section: ContentSection) {
  return String(section.section_type ?? "").toLowerCase() === "part";
}

export function isChapter(section: ContentSection) {
  return String(section.section_type ?? "").toLowerCase() === "chapter";
}

export function outlineFromSections(sections: ContentSection[]) {
  const active = sections
    .filter((s) => s.status !== "archived" && s.label !== "Harper Interview")
    .sort((a, b) => (a.section_index ?? 0) - (b.section_index ?? 0));

  const lines: string[] = [];
  for (const section of active) {
    if (isPart(section)) {
      if (lines.length) lines.push("");
      lines.push(String(section.label ?? "").trim());
    } else {
      lines.push(String(section.label ?? "").trim());
    }
  }

  return lines.filter(Boolean).join("\n");
}

type ParsedOutlineLine = {
  section_type: "part" | "chapter";
  label: string;
};

export function parseOutlineText(text: string): ParsedOutlineLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-*\u2022\s]+/, "").replace(/^\d+\.?\s+/, "").trim())
    .filter(Boolean);

  return lines.map((line) => {
    const sectionType: "part" | "chapter" = /^PART\b/i.test(line) ? "part" : "chapter";
    return {
      section_type: sectionType,
      label: line,
    };
  });
}
