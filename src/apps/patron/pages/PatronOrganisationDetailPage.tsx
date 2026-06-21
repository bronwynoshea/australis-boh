import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPatronOrganisationById } from '../api/patronApiMock';
import { usePatronStages } from '../hooks/usePatronStages';
import { usePatronActivities } from '../hooks/usePatronActivities';
import PatronActivityList from '../components/PatronActivityList';
import { getStageClasses } from '../utils/stageColors';
import type { PatronOrganisation } from '../types';

const PatronOrganisationDetailPage: React.FC = () => {
  const { organisationId } = useParams<{ organisationId: string }>();
  const navigate = useNavigate();
  const [organisation, setOrganisation] = useState<PatronOrganisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);

  const { stages } = usePatronStages();
  const { activities, loading: activitiesLoading } = usePatronActivities({
    organisationId: organisationId || undefined,
  });

  useEffect(() => {
    const loadOrganisation = async () => {
      if (!organisationId) {
        setError('No organisation ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchPatronOrganisationById(organisationId);
        if (!data) {
          setError('Organisation not found');
        } else {
          setOrganisation(data);
        }
      } catch (err) {
        console.error('Error loading organisation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load organisation');
      } finally {
        setLoading(false);
      }
    };

    loadOrganisation();
  }, [organisationId]);

  const getOrganisationStage = () => {
    if (!organisation?.pipeline_stage_id || !stages) return null;
    return stages.find((s) => s.id === organisation.pipeline_stage_id) || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading organisation...</div>
      </div>
    );
  }

  if (error || !organisation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-500 dark:text-boh-text">{error || 'Organisation not found'}</div>
      </div>
    );
  }

  const stage = getOrganisationStage();
  
  // Hook to detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-6">
          <button
            onClick={() => navigate('/patron/organisations')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            ← Back to Organisations
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
                {organisation.name}
              </h1>
              {stage && (
                <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${getStageClasses(stage.key)}`}>
                  {stage.label}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // TODO: Open Edit modal
                  console.log('Edit Organisation - TODO');
                }}
                className="px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-md bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub dark:hover:bg-boh-bg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setShowAddActivityModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                Add Activity
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={isMobile ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          {/* Left/Top: Profile */}
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-6">
            <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
                  Name
                </label>
                <div className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{organisation.name}</div>
              </div>
              {organisation.website && (
                <div>
                  <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
                    Website
                  </label>
                  <div className="mt-1 text-sm text-boh-text-light dark:text-boh-text">
                    <a
                      href={organisation.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {organisation.website}
                    </a>
                  </div>
                </div>
              )}
              {organisation.industry && (
                <div>
                  <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
                    Industry
                  </label>
                  <div className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{organisation.industry}</div>
                </div>
              )}
              {organisation.size && (
                <div>
                  <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
                    Size
                  </label>
                  <div className="mt-1 text-sm text-boh-text-light dark:text-boh-text">{organisation.size}</div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide">
                  Stage
                </label>
                <div className="mt-1">
                  {stage ? (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageClasses(stage.key)}`}>
                      {stage.label}
                    </span>
                  ) : (
                    <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Not assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Related People (Placeholder) */}
            <div className="mt-6 pt-6 border-t border-boh-border-light dark:border-boh-border">
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-2">Related People</h3>
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                TODO: Show related people if patron_person_organisation is in use
              </p>
            </div>
          </div>

          {/* Right/Bottom: Activity */}
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Activity</h2>
              <button
                onClick={() => setShowAddActivityModal(true)}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                Add Activity
              </button>
            </div>
            {activitiesLoading ? (
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading activities...</div>
            ) : (
              <PatronActivityList activities={activities} />
            )}
          </div>
        </div>
      </div>

      {/* Add Activity Modal (TODO) */}
      {showAddActivityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">Add Activity</h3>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
              TODO: Implement activity form
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddActivityModal(false)}
                className="px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-md bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub dark:hover:bg-boh-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Submit activity
                  console.log('Submit activity - TODO');
                  setShowAddActivityModal(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatronOrganisationDetailPage;

