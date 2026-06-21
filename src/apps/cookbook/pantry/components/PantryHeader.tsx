import React from "react";

const PantryHeader: React.FC = () => {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Pantry</h1>
      <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        Central store for soundbytes, AI personas, and knowledge packs.
      </p>
    </header>
  );
};

export default PantryHeader;
