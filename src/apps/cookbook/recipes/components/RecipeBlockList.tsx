import React from "react";
import type { RecipeDefinition } from "../types/recipes";

interface RecipeBlockListProps {
  recipes: RecipeDefinition[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const RecipeBlockList: React.FC<RecipeBlockListProps> = ({ recipes, activeId, onSelect }) => {
  return (
    <div className="space-y-2">
      {recipes.map((recipe) => (
        <button
          key={recipe.id}
          type="button"
          onClick={() => onSelect(recipe.id)}
          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
            activeId === recipe.id
              ? "border-primary bg-primary/5 text-boh-text-light dark:text-boh-text"
              : "border-boh-border-light bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light/60 dark:border-boh-border dark:bg-boh-bg"
          }`}
        >
          <div className="font-medium">{recipe.name}</div>
          <div className="mt-0.5 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {recipe.description}
          </div>
        </button>
      ))}
    </div>
  );
};

export default RecipeBlockList;
