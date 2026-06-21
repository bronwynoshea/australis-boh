import React from "react";
import { useNavigate } from "react-router-dom";

const sections = [
  { id: "pantry", label: "Pantry", description: "Soundbytes, AI personas, and knowledge packs." },
  { id: "quickserve", label: "QuickServe", description: "Short-form content: posts, hooks, and scripts." },
  { id: "slowcook", label: "Slow Cook", description: "Long-form stories, interviews, and chapters." },
  { id: "reservations", label: "Reservations", description: "Schedule when campaigns and content go live." },
  { id: "recipes", label: "Recipes", description: "Reusable templates for pages and blocks." },
] as const;

const CookbookHomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = (id: (typeof sections)[number]["id"]) => {
    switch (id) {
      case "pantry":
        navigate("/cookbook/pantry");
        break;
      case "quickserve":
        navigate("/cookbook/quickserve");
        break;
      case "slowcook":
        navigate("/cookbook/slowcook");
        break;
      case "reservations":
        navigate("/cookbook/reservations");
        break;
      case "recipes":
        navigate("/cookbook/recipes");
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Cookbook</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Plan, create, and schedule Australis marketing content.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...sections]
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            className="flex flex-col items-start rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-boh-bg px-4 py-3 text-left shadow-sm hover:border-boh-border-light hover:shadow-md transition-colors"
          >
            <span className="text-sm font-semibold text-boh-text-light dark:text-boh-text">
              {section.label}
            </span>
            <span className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {section.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CookbookHomePage;
