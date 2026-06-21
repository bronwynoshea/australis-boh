import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderIcon, LockIcon } from '../components/Icons';
import type { KeepSection } from '../types';

interface KeepOverviewPageProps {
  sections: KeepSection[];
  loading: boolean;
}

export default function KeepOverviewPage({ sections, loading }: KeepOverviewPageProps) {
  const navigate = useNavigate();

  const handleSectionClick = (sectionSlug: string) => {
    navigate(`/keep/${sectionSlug}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-2">
            Loading...
          </h2>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            Please wait
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-2">
          Keep Overview
        </h1>
        <p className="text-boh-text-sub-light dark:text-boh-text-sub">
          Select a section to browse files and folders from Google Drive.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-2">
              No sections available
            </h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Contact your administrator for access
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map((section) => (
            <button
              key={section.section_slug}
              onClick={() => handleSectionClick(section.section_slug)}
              className="group flex flex-col items-start p-4 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface hover:border-boh-primary/50 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-boh-primary/10 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-boh-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-boh-text-light dark:text-boh-text truncate">
                    {section.label}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-auto">
                <span className="text-xs px-2 py-1 rounded-full bg-boh-bg-light dark:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub capitalize">
                  {section.access_level.replace('_', ' ')}
                </span>
                {section.access_level === 'super_admin_only' && (
                  <LockIcon className="w-3 h-3 text-boh-text-sub-light dark:text-boh-text-sub" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
