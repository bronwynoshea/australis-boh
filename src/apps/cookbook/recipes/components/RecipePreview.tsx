import React from "react";
import type { RecipeDefinition } from "../types/recipes";

interface RecipePreviewProps {
  recipe: RecipeDefinition | null;
}

const RecipePreview: React.FC<RecipePreviewProps> = ({ recipe }) => {
  if (!recipe) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        Select a recipe to see the template preview.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{recipe.name}</h2>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{recipe.description}</p>
      <div className="mt-3 rounded-md border border-dashed border-boh-border-light/80 dark:border-boh-border p-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub whitespace-pre-wrap">
        Placeholder layout for this recipe. In a later phase, this will render the actual landing page or block
        structure from file-backed definitions.
      </div>
    </div>
  );
};

export default RecipePreview;
