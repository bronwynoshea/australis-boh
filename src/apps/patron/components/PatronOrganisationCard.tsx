import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PatronOrganisation, PatronPipelineStage } from '../types';
import { getStageClasses } from '../utils/stageColors';

interface PatronOrganisationCardProps {
  organisation: PatronOrganisation;
  stage?: PatronPipelineStage | null;
  onClick?: () => void;
  isMobile?: boolean;
}

const PatronOrganisationCard: React.FC<PatronOrganisationCardProps> = ({ organisation, stage, onClick, isMobile = false }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/patron/organisations/${organisation.id}`);
    }
  };

  const stageKey = stage?.key || 'unknown';
  const stageLabel = stage?.label || 'Unknown';

  if (isMobile) {
    return (
      <div
        onClick={handleClick}
        className="p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border cursor-pointer hover:shadow-md transition-shadow"
      >
        <div className="font-medium text-boh-text-light dark:text-boh-text mb-2">{organisation.name}</div>
        {organisation.website && (
          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">{organisation.website}</div>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {stage && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stageKey)}`}>
              {stageLabel}
            </span>
          )}
          {organisation.industry && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub">
              {organisation.industry}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="p-4 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border cursor-pointer hover:shadow-md transition-shadow mb-3"
    >
      <div className="font-medium text-boh-text-light dark:text-boh-text mb-2">{organisation.name}</div>
      {organisation.website && (
        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">
          <a
            href={organisation.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {organisation.website}
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {stage && (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stageKey)}`}>
            {stageLabel}
          </span>
        )}
        {organisation.industry && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub">
            {organisation.industry}
          </span>
        )}
        {organisation.size && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub">
            {organisation.size}
          </span>
        )}
      </div>
    </div>
  );
};

export default PatronOrganisationCard;

