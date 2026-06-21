import React from 'react';
import { FolderIcon, FileTextIcon, ExternalLinkIcon } from './Icons';

export interface QuickLink {
  id: string;
  label: string;
  targetType: 'folder' | 'file';
  targetId: string;
  subtitle?: string;
  description?: string;
  sortOrder: number;
}

interface CrewLinksProps {
  links: QuickLink[];
  onNavigate: (targetId: string, type: 'folder' | 'file') => void;
  loading?: boolean;
}

export default function CrewLinks({ links, onNavigate, loading }: CrewLinksProps) {
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
          Crew Links
        </h3>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-boh-surface-light dark:bg-boh-surface animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
        Crew Links
      </h3>
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {links.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub italic text-center">
              No crew links available
            </p>
          </div>
        ) : (
          links.map((link) => (
            <button
              key={link.id}
              onClick={() => onNavigate(link.targetId, link.targetType)}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface hover:border-boh-primary/50 hover:shadow-sm transition-all text-left"
            >
              <div className="p-2 rounded bg-boh-primary/10 text-boh-primary flex-shrink-0">
                {link.targetType === 'folder' ? (
                  <FolderIcon className="w-4 h-4" />
                ) : (
                  <FileTextIcon className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-boh-text-light dark:text-boh-text truncate">
                    {link.label}
                  </span>
                  <ExternalLinkIcon className="w-3 h-3 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" />
                </div>
                {link.subtitle && (
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-0.5">
                    {link.subtitle}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
