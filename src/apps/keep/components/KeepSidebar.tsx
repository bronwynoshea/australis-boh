// Updated: 2026-04-12 14:10 - BrainIcon for Whiteboard, VaultIcon for Gold Library
import React from 'react';
import { SettingsIcon, FolderIcon, BrainIcon, VaultIcon, LightbulbIcon, CheckCircleIcon } from './Icons';
import { useSupabaseFolders } from '../hooks/useSupabaseFolders';
import type { KeepFolder } from '../types';
import { useNavigate, useLocation } from 'react-router-dom';

interface KeepSidebarProps {
  currentArea: 'workspace' | 'gold_library' | 'whiteboard' | null;
  currentFolderId: string | null;
  activeRootFolderId: string | null;
  onNavigate: (area: 'workspace' | 'gold_library', folderId: string, folderName: string, rootFolderId: string) => void;
  onAreaClick: (area: 'workspace' | 'gold_library' | 'whiteboard') => void;
  isSuperAdmin: boolean;
  onAdminClick: () => void;
}

export default function KeepSidebar({
  currentArea,
  currentFolderId,
  activeRootFolderId,
  onNavigate,
  onAreaClick,
  isSuperAdmin,
  onAdminClick,
}: KeepSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isReviewQueue = location.pathname.includes('/review-queue');

  // Load root folders for workspace
  const { folders: workspaceFolders, loading: workspaceLoading } = useSupabaseFolders({
    area: 'workspace',
    systemFolderName: 'Workspace',
  });

  // Load root folders for gold_library
  const { folders: goldLibraryFolders, loading: goldLibraryLoading } = useSupabaseFolders({
    area: 'gold_library',
    systemFolderName: '00-GOLD-LIBRARY',
  });

  const renderFolderList = (folders: KeepFolder[], area: 'workspace' | 'gold_library', loading: boolean) => {
    if (loading) {
      return (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-lg bg-boh-surface-light dark:bg-boh-surface animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (folders.length === 0) {
      return (
        <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub px-3 py-2">
          No folders
        </p>
      );
    }

    return (
      <div className="space-y-1">
        {folders.map((folder) => {
          // Active if: this folder is the current folder, or it's the root of the current nested path
          const isActive = currentArea === area && (
            currentFolderId === folder.id || activeRootFolderId === folder.id
          );
          return (
            <button
              key={folder.id}
              onClick={() => onNavigate(area, folder.id, folder.name, folder.id)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left
                ${isActive
                  ? 'bg-boh-primary/10 text-boh-primary font-medium'
                  : 'text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-surface-light dark:hover:bg-boh-surface'
                }
              `}
            >
              <span className="truncate">{folder.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-boh-border-light dark:border-boh-border">
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
          Keep
        </h2>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Workspace
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* THINKING Section */}
        <div>
          <p className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3 px-3">
            Thinking
          </p>
          <button
            onClick={() => onAreaClick('whiteboard')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
              ${currentArea === 'whiteboard'
                ? 'bg-boh-primary/10 text-boh-primary font-medium'
                : 'text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface'
              }
            `}
          >
            <BrainIcon className="w-4 h-4" />
            <span className="font-medium">Whiteboard</span>
          </button>
        </div>

        {/* WORK Section */}
        <div>
          <p className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3 px-3">
            Work
          </p>
          <button
            onClick={() => onAreaClick('workspace')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-2 transition-colors
              ${currentArea === 'workspace' && !currentFolderId
                ? 'bg-boh-primary/10 text-boh-primary font-medium'
                : 'text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface'
              }
            `}
          >
            <FolderIcon className="w-4 h-4" />
            <span className="font-medium">Workspace</span>
          </button>
          <div className="pl-4 border-l-2 border-boh-border-light dark:border-boh-border ml-4">
            {renderFolderList(workspaceFolders, 'workspace', workspaceLoading)}
          </div>
        </div>

        {/* KNOWLEDGE Section */}
        <div>
          <p className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider mb-3 px-3">
            Knowledge
          </p>
          <button
            onClick={() => onAreaClick('gold_library')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-2 transition-colors
              ${currentArea === 'gold_library' && !currentFolderId
                ? 'bg-boh-primary/10 text-boh-primary font-medium'
                : 'text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface'
              }
            `}
          >
            <VaultIcon className="w-4 h-4" />
            <span className="font-medium">Gold Library</span>
          </button>
          <div className="pl-4 border-l-2 border-boh-border-light dark:border-boh-border ml-4 mb-2">
            {renderFolderList(goldLibraryFolders, 'gold_library', goldLibraryLoading)}
          </div>
          <button
            onClick={() => navigate('/keep/review-queue')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
              ${isReviewQueue
                ? 'bg-boh-primary/10 text-boh-primary font-medium'
                : 'text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:hover:bg-boh-surface'
              }
            `}
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span className="font-medium">Review Queue</span>
          </button>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="p-4 border-t border-boh-border-light dark:border-boh-border">
          <button
            onClick={onAdminClick}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-surface dark:hover:bg-boh-bg transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Admin Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}
