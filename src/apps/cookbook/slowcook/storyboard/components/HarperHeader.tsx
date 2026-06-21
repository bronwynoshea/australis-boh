import React from "react";

interface HarperHeaderProps {
  blueprintName?: string;
  soundbyteName?: string;
}

const HarperHeader: React.FC<HarperHeaderProps> = ({ blueprintName, soundbyteName }) => {
  return (
    <header className="mb-4 space-y-1">
      <h1 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
        Interview with Harper
      </h1>
      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        Guiding you through a chaptered Content Blueprint using your Soundbyte Strategy.
      </p>
      <div className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub flex flex-wrap gap-2 mt-1">
        {blueprintName && (
          <span className="inline-flex items-center rounded-full border border-boh-border-light/70 dark:border-boh-border px-2 py-0.5">
            <span className="font-semibold mr-1">Blueprint:</span>
            {blueprintName}
          </span>
        )}
        {soundbyteName && (
          <span className="inline-flex items-center rounded-full border border-boh-border-light/70 dark:border-boh-border px-2 py-0.5">
            <span className="font-semibold mr-1">Soundbyte:</span>
            {soundbyteName}
          </span>
        )}
      </div>
    </header>
  );
};

export default HarperHeader;
