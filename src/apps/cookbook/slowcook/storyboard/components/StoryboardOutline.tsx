import React from "react";
import type { ContentSection } from "../../../types/content";

interface StoryboardOutlineProps {
  sections: ContentSection[];
  activeSectionId: string | null;
  onSelectSection?: (sectionId: string) => void;
  partsAreHeaders?: boolean; // when true, PART rows are styled headers and not clickable
}

const StoryboardOutline: React.FC<StoryboardOutlineProps> = ({
  sections,
  activeSectionId,
  onSelectSection,
  partsAreHeaders = false,
}) => {
  if (sections.length === 0) {
    return (
      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        No chapters yet. Chapters will appear here as the interview progresses.
      </div>
    );
  }

  const isPart = (s: ContentSection) => String(s.section_type ?? "").toLowerCase() === "part";
  const isChapter = (s: ContentSection) => String(s.section_type ?? "").toLowerCase() === "chapter";

  // Number ONLY chapters (parts don’t increment)
  let chapterCounter = 0;

  return (
    <ol className="space-y-1 text-xs">
      {sections.map((section) => {
        const partRow = isPart(section);
        const chapterRow = isChapter(section);

        const clickable = Boolean(onSelectSection) && (!partsAreHeaders || !partRow);
        const isActive = section.id === activeSectionId;

        const pillNumber = chapterRow ? ++chapterCounter : null;

        if (partsAreHeaders && partRow) {
          return (
            <li
              key={section.id}
              className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-boh-text-light dark:bg-boh-bg dark:text-boh-text"
              title={section.label ?? ""}
            >
              <span className="truncate block">{section.label}</span>
            </li>
          );
        }

        const base =
          "flex items-center justify-between rounded-md px-2 py-1 transition " +
          (isActive
            ? "bg-primary/10 text-boh-text-light dark:text-boh-text"
            : "text-boh-text-sub-light dark:text-boh-text-sub");

        const buttonLike = clickable ? "hover:bg-slate-50 cursor-pointer" : "cursor-default";

        const RowTag: any = clickable ? "button" : "div";
        const rowProps = clickable
          ? {
              type: "button",
              onClick: () => onSelectSection?.(section.id),
            }
          : {};

        return (
          <li key={section.id}>
            <RowTag
              {...rowProps}
              className={base + " " + buttonLike + " w-full text-left"}
              title={section.label ?? ""}
            >
              <span className="flex items-center gap-2 min-w-0">
                {pillNumber !== null ? (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-boh-border-light/80 text-[10px] font-semibold">
                    {pillNumber}
                  </span>
                ) : (
                  <span className="inline-flex h-5 w-5 shrink-0" />
                )}

                <span className="truncate">{section.label}</span>
              </span>
            </RowTag>
          </li>
        );
      })}
    </ol>
  );
};

export default StoryboardOutline;
