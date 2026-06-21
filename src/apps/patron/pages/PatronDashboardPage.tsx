import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatronStages } from '../hooks/usePatronStages';
import { usePatronPeople } from '../hooks/usePatronPeople';
import { usePatronActivities } from '../hooks/usePatronActivities';
import { getStageClasses } from '../utils/stageColors';
import PatronActivityList from '../components/PatronActivityList';
import type { PatronPerson } from '../types';

const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return 'Unknown time';
  
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
};

const PatronDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { stages, loading: stagesLoading } = usePatronStages();
  const { people, loading: peopleLoading } = usePatronPeople();
  const { activities, loading: activitiesLoading } = usePatronActivities();

  // Calculate pipeline overview
  const pipelineOverview = React.useMemo(() => {
    if (!stages || !people) return [];
    return stages.map((stage) => {
      const count = people.filter((p) => p.pipeline_stage_id === stage.id).length;
      return { stage, count };
    });
  }, [stages, people]);

  // Get recently added people
  const recentlyAddedPeople = React.useMemo(() => {
    if (!people || !stages) return [];
    return [...people]
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((person) => {
        const stage = stages.find((s) => s.id === person.pipeline_stage_id);
        return { person, stage };
      });
  }, [people, stages]);

  // Get recent activities (limited to 10)
  const recentActivities = React.useMemo(() => {
    return activities.slice(0, 10);
  }, [activities]);

  const getPersonName = (person: PatronPerson): string => {
    return [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed Person';
  };

  if (stagesLoading || peopleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
            Patron Dashboard
          </h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Overview of your CRM pipeline and recent activity
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Pipeline Overview */}
            <div className="bg-boh-surface-light dark:bg-boh-bg rounded-lg border border-boh-border-light dark:border-boh-border p-6">
              <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
                Pipeline Overview
              </h2>
              <div className="space-y-3">
                {pipelineOverview.length === 0 ? (
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">No pipeline stages found</p>
                ) : (
                  pipelineOverview.map(({ stage, count }) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg cursor-pointer hover:bg-boh-surface-light dark:hover:bg-boh-surface transition-colors"
                      onClick={() => navigate(`/patron/pipeline`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stage.key)}`}>
                          {stage.label}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recently Added People */}
            <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-6">
              <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
                Recently Added People
              </h2>
              <div className="space-y-3">
                {recentlyAddedPeople.length === 0 ? (
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">No people added yet</p>
                ) : (
                  recentlyAddedPeople.map(({ person, stage }) => (
                    <div
                      key={person.id}
                      className="p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg cursor-pointer hover:bg-boh-surface-light dark:hover:bg-boh-surface transition-colors"
                      onClick={() => navigate(`/patron/people/${person.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-boh-text-light dark:text-boh-text">
                          {getPersonName(person)}
                        </div>
                        {stage && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stage.key)}`}>
                            {stage.label}
                          </span>
                        )}
                      </div>
                      {person.email && (
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{person.email}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            {/* Recent Activity */}
            <div className="bg-boh-surface-light dark:bg-boh-bg rounded-lg border border-boh-border-light dark:border-boh-border p-6">
              <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
                Recent Activity
              </h2>
              {activitiesLoading ? (
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading activities...</div>
              ) : (
                <PatronActivityList activities={recentActivities} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatronDashboardPage;

