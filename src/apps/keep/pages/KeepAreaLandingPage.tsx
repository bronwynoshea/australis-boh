import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseIcon, CrownIcon, FolderIcon } from '../components/Icons';
import { useSupabaseFolders } from '../hooks/useSupabaseFolders';

interface KeepAreaLandingPageProps {
  area: 'workspace' | 'gold_library';
  areaLabel: string;
}

const areaConfig = {
  workspace: {
    icon: BriefcaseIcon,
    title: 'Workspace',
    subtitle: 'Working files & drafts',
    color: 'text-boh-text-light dark:text-boh-text',
    borderColor: 'border-boh-border-light dark:border-boh-border',
  },
  gold_library: {
    icon: CrownIcon,
    title: 'Gold Library',
    subtitle: 'Approved & final files',
    color: 'text-boh-text-light dark:text-boh-text',
    borderColor: 'border-boh-border-light dark:border-boh-border',
  },
};

export default function KeepAreaLandingPage({
  area,
  areaLabel,
}: KeepAreaLandingPageProps) {
  const navigate = useNavigate();
  const config = areaConfig[area];
  const Icon = config.icon;

  // Load root folders for this area
  const { folders, loading } = useSupabaseFolders({
    area,
    parentId: null,
  });

  if (loading) {
    return (
      <div className="flex flex-col h-full p-6">
        <div className={`border-b ${config.borderColor} pb-6 mb-6`}>
          <div className="h-8 w-48 bg-boh-surface-light dark:bg-boh-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-boh-surface-light dark:bg-boh-surface rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Area Header */}
      <div className={`border-b ${config.borderColor} pb-6 mb-6`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-boh-surface-light dark:bg-boh-surface ${config.color} flex items-center justify-center border ${config.borderColor}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${config.color}`}>
              {areaLabel}
            </h1>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {config.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Folder Grid */}
      <div>
        <h2 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
          Select a Folder
        </h2>
        {folders.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-boh-border-light dark:border-boh-border rounded-xl">
            <FolderIcon className="w-8 h-8 text-boh-text-sub-light dark:text-boh-text-sub mx-auto mb-2" />
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No folders available
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  const encodedName = encodeURIComponent(folder.name);
                  navigate(`/keep/${area}/${folder.id}/${encodedName}`);
                }}
                className="group flex items-center gap-4 p-6 rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface hover:border-boh-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-boh-primary/10 flex items-center justify-center flex-shrink-0">
                  <FolderIcon className="w-6 h-6 text-boh-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-boh-text-light dark:text-boh-text group-hover:text-boh-primary transition-colors truncate">
                    {folder.name}
                  </h3>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                    {area === 'workspace' ? 'Working files' : 'Gold standard files'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
