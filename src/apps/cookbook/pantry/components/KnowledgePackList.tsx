import React from "react";
import type { AIKnowledgePack } from "../types/pantry";

interface KnowledgePackListProps {
  items: AIKnowledgePack[];
  onManage?: () => void;
}

const KnowledgePackList: React.FC<KnowledgePackListProps> = ({ items, onManage }) => {
  const handleManage = () => {
    if (onManage) {
      onManage();
      return;
    }
    // eslint-disable-next-line no-console
    console.log("Manage Knowledge Packs");
  };

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Knowledge Packs</h2>
        <button
          type="button"
          onClick={handleManage}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
        >
          Manage Knowledge Packs
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-boh-bg">
        <ul className="divide-y divide-boh-border-light/60 dark:divide-boh-border text-xs">
          {items.map((item) => (
            <li key={item.id} className="px-3 py-2">
              <div className="text-boh-text-light dark:text-boh-text font-medium">{item.name}</div>
              <div className="mt-0.5 text-boh-text-sub-light dark:text-boh-text-sub text-[11px]">
                {item.description}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default KnowledgePackList;
