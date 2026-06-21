import React from "react";
import type { AIPersona } from "../types/pantry";

interface AIPersonaListProps {
  items: AIPersona[];
  onManage?: () => void;
}

const AIPersonaList: React.FC<AIPersonaListProps> = ({ items, onManage }) => {
  const handleManage = () => {
    if (onManage) {
      onManage();
      return;
    }
    // eslint-disable-next-line no-console
    console.log("Manage Personas");
  };

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">AI Personas</h2>
        <button
          type="button"
          onClick={handleManage}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/80"
        >
          Manage Personas
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-boh-bg">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-boh-bg-light/60 dark:bg-boh-bg/80">
            <tr>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Name</th>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Role</th>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Default model</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-boh-border-light/60 dark:border-boh-border">
                <td className="px-3 py-2 text-boh-text-light dark:text-boh-text">{item.name}</td>
                <td className="px-3 py-2 text-boh-text-sub-light dark:text-boh-text-sub">{item.role}</td>
                <td className="px-3 py-2 text-boh-text-sub-light dark:text-boh-text-sub">{item.defaultModel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AIPersonaList;
