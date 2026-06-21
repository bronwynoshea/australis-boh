import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatronStages } from '../hooks/usePatronStages';
import { usePatronPeople } from '../hooks/usePatronPeople';
import PatronPersonCard from '../components/PatronPersonCard';
import PatronSelect from '../components/PatronSelect';
import { getStageClasses } from '../utils/stageColors';
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

const PatronPeoplePage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');

  const { stages, loading: stagesLoading } = usePatronStages();
  const { people, loading: peopleLoading } = usePatronPeople({
    search: search || undefined,
    pipelineStageId: selectedStageId || undefined,
    assignedTo: selectedAssignedTo || undefined,
  });

  const getPersonName = (person: PatronPerson): string => {
    return [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed Person';
  };

  const getPersonStage = (person: PatronPerson) => {
    if (!person.pipeline_stage_id || !stages) return null;
    return stages.find((s) => s.id === person.pipeline_stage_id) || null;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
            People
          </h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Manage your contacts and relationships
          </p>
        </header>

        {/* Filter Bar */}
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-md bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text placeholder-boh-text-sub-light dark:placeholder-boh-text-sub focus:outline-none focus:ring-2 focus:ring-boh-primary"
              />
            </div>
            <div>
              <PatronSelect
                value={selectedStageId}
                onChange={setSelectedStageId}
                options={[
                  { value: '', label: 'All Stages' },
                  ...stages.map((stage) => ({
                    value: stage.id,
                    label: stage.label
                  }))
                ]}
                placeholder="All Stages"
              />
            </div>
            <div>
              <button
                onClick={() => {
                  // TODO: Open Add Person modal
                  console.log('Add Person - TODO');
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                Add Person
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {peopleLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading people...</div>
          </div>
        ) : people.length === 0 ? (
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border p-12 text-center">
            <p className="text-boh-text-sub-light dark:text-boh-text-sub">No people found</p>
          </div>
        ) : isMobile ? (
          // Mobile: Card Layout
          <div className="space-y-4">
            {people.map((person) => {
              const stage = getPersonStage(person);
              return (
                <div
                  key={person.id}
                  onClick={() => navigate(`/patron/people/${person.id}`)}
                  className="p-4 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="font-medium text-boh-text-light dark:text-boh-text dark:text-boh-text mb-2">
                    {getPersonName(person)}
                  </div>
                  {person.email && (
                    <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">{person.email}</div>
                  )}
                  {person.phone && (
                    <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">{person.phone}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {stage && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stage.key)}`}>
                        {stage.label}
                      </span>
                    )}
                    {person.source && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:text-boh-text-sub">
                        {person.source}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop: Table Layout
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-boh-bg-light dark:bg-boh-bg">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                {people.map((person) => {
                  const stage = getPersonStage(person);
                  return (
                    <tr
                      key={person.id}
                      onClick={() => navigate(`/patron/people/${person.id}`)}
                      className="hover:bg-boh-bg-light dark:hover:bg-boh-bg dark:hover:bg-boh-bg cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-boh-text-light dark:text-boh-text dark:text-boh-text">
                          {getPersonName(person)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{person.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{person.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {stage ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stage.key)}`}>
                            {stage.label}
                          </span>
                        ) : (
                          <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{person.source || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {person.created_at
                            ? new Date(person.created_at).toLocaleDateString()
                            : '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatronPeoplePage;

