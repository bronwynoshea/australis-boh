import React from "react";
import type { RecipeTemplateForm } from "../types/recipes";

export interface RecipeTemplateFieldsProps {
  form: RecipeTemplateForm;
  updateField: <K extends keyof RecipeTemplateForm>(key: K, value: RecipeTemplateForm[K]) => void;
}

const RecipeTemplateFields: React.FC<RecipeTemplateFieldsProps> = ({ form, updateField }) => {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">Slug</label>
          <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
            Lowercase, dashes/underscores only. Used by the landing site to pick a campaign.
          </p>
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">Headline</label>
        <input
          type="text"
          className="w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
          value={form.headline}
          onChange={(e) => updateField("headline", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">Body copy</label>
        <textarea
          className="min-h-[80px] w-full resize-y rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
          value={form.body}
          onChange={(e) => updateField("body", e.target.value)}
        />
      </div>
    </>
  );
};

export default RecipeTemplateFields;
