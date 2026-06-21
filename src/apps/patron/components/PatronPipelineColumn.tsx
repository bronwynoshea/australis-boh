import React from 'react';
import type { PatronPerson, PatronPipelineStage } from '../types';
import PatronPersonCard from './PatronPersonCard';

interface PatronPipelineColumnProps {
  stage: PatronPipelineStage;
  people: PatronPerson[];
  onPersonClick?: (person: PatronPerson) => void;
  isMobile?: boolean;
}

const PatronPipelineColumn: React.FC<PatronPipelineColumnProps> = ({
  stage,
  people,
  onPersonClick,
  isMobile = false
}) => {
  return (
    <div className={`flex-shrink-0 ${isMobile ? 'w-full mb-6' : 'w-full h-full flex flex-col'}`}>
      <div className="bg-boh-bg-light dark:bg-boh-bg rounded-lg p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="font-semibold text-boh-text-light dark:text-boh-text">{stage.label}</h3>
          <span className="px-2 py-1 text-xs font-medium bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub rounded-full">
            {people.length}
          </span>
        </div>
        {stage.description && (
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mb-4 flex-shrink-0">{stage.description}</p>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {people.length === 0 ? (
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub text-center py-8">
              No people in this stage
            </div>
          ) : (
            people.map((person) => (
              <PatronPersonCard
                key={person.id}
                person={person}
                stage={stage}
                onClick={onPersonClick ? () => onPersonClick(person) : undefined}
                isMobile={isMobile}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PatronPipelineColumn;

