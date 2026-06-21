import React, { useEffect, useState } from "react";
import RecipeBlockList from "./components/RecipeBlockList";
import RecipePreview from "./components/RecipePreview";
import RecipeTemplateFields from "./components/RecipeTemplateFields";
import type { RecipeDefinition, RecipeTemplateForm } from "./types/recipes";
import { listReservations } from "../reservations/services/reservationsApi";
import type { CampaignBanner } from "../reservations/types/reservations";

const MOCK_RECIPES: RecipeDefinition[] = [
  {
    id: "launch-landing",
    name: "Launch Landing Page",
    category: "Landing Page",
    description: "Hero, social proof, offer, and FAQ for a primary launch.",
  },
  {
    id: "waitlist-page",
    name: "Waitlist Page",
    category: "Landing Page",
    description: "Short page for capturing early interest ahead of a launch.",
  },
  {
    id: "feature-announcement-block",
    name: "Feature Announcement Block",
    category: "Content Block",
    description: "Reusable block for announcing new features in emails and pages.",
  },
];

const RecipesPage: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(MOCK_RECIPES[0]?.id ?? null);
  const [templateForm, setTemplateForm] = useState<RecipeTemplateForm>({
    slug: "launch-landing",
    headline: "Announce your new launch with confidence",
    body: "Use this recipe to structure your hero, social proof, offer, and FAQ sections.",
  });
  const [scheduleSummary, setScheduleSummary] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const campaigns = await listReservations();
        if (!campaigns || campaigns.length === 0) {
          setScheduleSummary(null);
          return;
        }

        const matching = campaigns.find((c: CampaignBanner) => c.slug === templateForm.slug);
        const target = matching ?? campaigns.find((c: CampaignBanner) => c.status === "active" && c.enabled) ?? campaigns[0];

        if (!target) {
          setScheduleSummary(null);
          return;
        }

        const formatDate = (iso: string | null) => {
          if (!iso) return "Not set";
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return "Not set";
          return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
        };

        const startLabel = formatDate(target.starts_at);
        const endLabel = target.ends_at ? formatDate(target.ends_at) : "open-ended";
        const statusLabel = target.status === "active" && target.enabled ? "Active" : "Draft";

        setScheduleSummary(`${statusLabel} · ${startLabel} → ${endLabel} (Australia/Sydney)`);
      } catch (err) {
        console.error("[RecipesPage] Error loading schedule summary", err);
        setScheduleSummary(null);
      }
    })();
  }, [templateForm.slug]);

  const activeRecipe = MOCK_RECIPES.find((recipe) => recipe.id === activeId) ?? null;

  const updateTemplateField = <K extends keyof RecipeTemplateForm>(key: K, value: RecipeTemplateForm[K]) => {
    setTemplateForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Recipes</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Reusable templates and blocks for landing pages and campaigns.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4">
          <RecipeBlockList recipes={MOCK_RECIPES} activeId={activeId} onSelect={setActiveId} />
        </div>
        <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 min-h-[220px] space-y-4">
          <RecipeTemplateFields form={templateForm} updateField={updateTemplateField} />
          <div className="pt-2 border-t border-boh-border-light/70 dark:border-boh-border space-y-3">
            <RecipePreview recipe={activeRecipe} />

            {scheduleSummary && (
              <div className="rounded-md border border-dashed border-boh-border-light/70 dark:border-boh-border/70 bg-boh-bg-light dark:bg-boh-bg/60 dark:bg-boh-surface/40 px-3 py-2">
                <p className="text-[11px] font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-0.5">
                  Scheduled window (from Reservations)
                </p>
                <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">{scheduleSummary}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipesPage;
