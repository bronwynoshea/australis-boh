import React, { useState } from "react";
import QuickServeForm from "./components/QuickServeForm";
import QuickServePreview from "./components/QuickServePreview";
import { generateQuickServeDraft } from "./services/quickServeApi";
import type { QuickServeFormat } from "./types/quickServe";

const QuickServePage: React.FC = () => {
  const [draft, setDraft] = useState<string>("");

  const handleGenerate = async (options: {
    soundbyteId: string;
    personaId: string;
    format: QuickServeFormat;
    brief: string;
  }) => {
    const result = await generateQuickServeDraft({
      soundbyteId: options.soundbyteId,
      personaId: options.personaId,
      format: options.format,
      brief: options.brief,
    });
    setDraft(result.content);
  };

  const handleRegenerate = () => {
    console.log("Regenerate QuickServe draft (mock)");
  };

  const handleSave = () => {
    console.log("Save QuickServe draft (mock)");
  };

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">QuickServe</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Short-form content (social posts, hooks, scripts).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4">
          <QuickServeForm onGenerate={handleGenerate} />
        </div>
        <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4">
          <QuickServePreview
            content={draft}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
};

export default QuickServePage;
