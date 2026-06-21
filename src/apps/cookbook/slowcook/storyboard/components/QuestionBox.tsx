import React from "react";

interface QuestionBoxProps {
  question: string | null;
  canStartInterview: boolean;
  isStarting: boolean;
  onStartInterview?: () => void;
}

const QuestionBox: React.FC<QuestionBoxProps> = ({
  question,
  canStartInterview,
  isStarting,
  onStartInterview,
}) => {
  const hasQuestion = Boolean(question && question.trim().length > 0);

  return (
    <div className="rounded-xl border border-boh-border-light/80 bg-boh-surface-light dark:bg-boh-surface/90 p-4 shadow-sm dark:border-boh-border dark:bg-boh-bg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-boh-text-sub">Current question</p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-boh-text dark:text-boh-text">
            {hasQuestion
              ? question
              : canStartInterview
                ? "No question yet. Start the interview when you’re ready."
                : "Select a chapter and soundbyte to begin."}
          </p>
        </div>
        {!hasQuestion && canStartInterview && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
            onClick={onStartInterview}
            disabled={isStarting}
          >
            {isStarting ? "Starting…" : "Start interview"}
          </button>
        )}
      </div>
    </div>
  );
};

export default QuestionBox;
