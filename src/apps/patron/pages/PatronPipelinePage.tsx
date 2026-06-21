import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatronStages } from '../hooks/usePatronStages';
import { usePatronPeople } from '../hooks/usePatronPeople';
import PatronPipelineColumn from '../components/PatronPipelineColumn';
import type { PatronPerson } from '../types';

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

const PatronPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { stages, loading: stagesLoading } = usePatronStages();
  const { people, loading: peopleLoading } = usePatronPeople();

  // Group people by stage
  const peopleByStage = React.useMemo(() => {
    if (!stages || !people) return {};
    const grouped: Record<string, PatronPerson[]> = {};
    stages.forEach((stage) => {
      grouped[stage.id] = people.filter((p) => p.pipeline_stage_id === stage.id);
    });
    return grouped;
  }, [stages, people]);

  const handlePersonClick = (person: PatronPerson) => {
    navigate(`/patron/people/${person.id}`);
  };

  if (stagesLoading || peopleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading pipeline...</div>
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">No pipeline stages found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
            Pipeline
          </h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            {isMobile
              ? 'View people grouped by pipeline stage'
              : 'Kanban board view of people in your pipeline'}
          </p>
        </header>

        {isMobile ? (
          // Mobile: Vertical list of groups
          <div className="space-y-6">
            {stages.map((stage) => (
              <div key={stage.id} className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                    {stage.label}
                  </h2>
                  <span className="px-2 py-1 text-xs font-medium bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text text-boh-text-light dark:text-boh-text-sub rounded-full">
                    {peopleByStage[stage.id]?.length || 0}
                  </span>
                </div>
                {stage.description && (
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">{stage.description}</p>
                )}
                <div className="space-y-3">
                  {peopleByStage[stage.id]?.length === 0 ? (
                    <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub text-center py-4">
                      No people in this stage
                    </div>
                  ) : (
                    peopleByStage[stage.id]?.map((person) => (
                      <div
                        key={person.id}
                        onClick={() => handlePersonClick(person)}
                        className="p-3 bg-boh-bg-light dark:bg-boh-bg rounded-lg cursor-pointer hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
                      >
                        <div className="font-medium text-boh-text-light dark:text-boh-text">
                          {[person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed Person'}
                        </div>
                        {person.email && (
                          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">{person.email}</div>
                        )}
                        {person.source && (
                          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">{person.source}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop: Responsive Kanban board with stable layout
          <div className="w-full pb-4">
            <div className="flex gap-3 h-[calc(100vh-280px)] min-h-[500px]">
              {stages.map((stage) => (
                <div 
                  key={stage.id} 
                  className="flex-1 min-w-[200px] max-w-[280px]"
                >
                  <PatronPipelineColumn
                    stage={stage}
                    people={peopleByStage[stage.id] || []}
                    onPersonClick={handlePersonClick}
                    isMobile={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatronPipelinePage;

