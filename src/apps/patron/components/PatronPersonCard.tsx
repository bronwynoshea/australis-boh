import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PatronPerson, PatronPipelineStage } from '../types';
import { getStageClasses } from '../utils/stageColors';

interface PatronPersonCardProps {
  person: PatronPerson;
  stage?: PatronPipelineStage | null;
  onClick?: () => void;
  isMobile?: boolean;
}

const PatronPersonCard: React.FC<PatronPersonCardProps> = ({ person, stage, onClick, isMobile = false }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/patron/people/${person.id}`);
    }
  };

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed Person';
  const stageKey = stage?.key || 'unknown';
  const stageLabel = stage?.label || 'Unknown';

  if (isMobile) {
    return (
      <div
        onClick={handleClick}
        className="p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border cursor-pointer hover:shadow-md transition-shadow"
      >
        <div className="font-medium text-boh-text-light dark:text-boh-text mb-2">{fullName}</div>
        {person.email && (
          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">{person.email}</div>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {stage && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stageKey)}`}>
              {stageLabel}
            </span>
          )}
          {person.source && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub">
              {person.source}
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
      <div className="font-medium text-boh-text-light dark:text-boh-text mb-2">{fullName}</div>
      {person.email && (
        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">{person.email}</div>
      )}
      {person.phone && (
        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">{person.phone}</div>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {stage && (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stageKey)}`}>
            {stageLabel}
          </span>
        )}
        {person.source && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub">
            {person.source}
          </span>
        )}
      </div>
    </div>
  );
};

export default PatronPersonCard;

