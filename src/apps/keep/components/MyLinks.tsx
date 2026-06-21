import React from 'react';
import { FolderIcon, FileTextIcon, XIcon } from './Icons';
import type { QuickLink } from './CrewLinks';

interface MyLinksProps {
  links: QuickLink[];
  onNavigate: (targetId: string, type: 'folder' | 'file') => void;
  onRemoveLink: (linkId: string) => Promise<{ success: boolean; error?: string }> | void;
  loading?: boolean;
}

export default function MyLinks({ links, onNavigate, onRemoveLink, loading }: MyLinksProps) {
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
          My Links
        </h3>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-boh-surface-light dark:bg-boh-surface animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-4">
        My Links
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {links.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub italic text-center">
              No personal links yet<br />
              <span className="text-xs">Add links from files or folders</span>
            </p>
          </div>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className="group flex items-center gap-3 p-2 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
            >
              <button
                onClick={() => onNavigate(link.targetId, link.targetType)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                {link.targetType === 'folder' ? (
                  <FolderIcon className="w-4 h-4 text-boh-primary flex-shrink-0" />
                ) : (
                  <FileTextIcon className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub flex-shrink-0" />
                )}
                <span className="text-sm text-boh-text-light dark:text-boh-text truncate">
                  {link.label}
                </span>
              </button>
              <button
                onClick={() => onRemoveLink(link.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all"
                title="Remove from My Links"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
