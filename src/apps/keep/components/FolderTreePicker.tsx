import React, { useState, useEffect } from 'react';
import { FolderIcon, ChevronRightIcon, ChevronDownIcon } from './Icons';
import type { KeepFolder } from '../types';

interface FolderNode extends KeepFolder {
  children: FolderNode[];
}

interface FolderTreePickerProps {
  folders: KeepFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string, folderPath: string) => void;
}

const buildFolderTree = (folders: KeepFolder[]): FolderNode[] => {
  const folderMap = new Map<string, FolderNode>();
  const rootFolders: FolderNode[] = [];

  // Create nodes for all folders
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // Build hierarchy
  folders.forEach(folder => {
    const node = folderMap.get(folder.id);
    if (!node) return;

    if (folder.parent_id) {
      const parent = folderMap.get(folder.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not in list, treat as root
        rootFolders.push(node);
      }
    } else {
      rootFolders.push(node);
    }
  });

  return rootFolders;
};

const buildFolderPath = (folderId: string, folders: KeepFolder[]): string => {
  const folderMap = new Map(folders.map(f => [f.id, f]));
  const path: string[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = folderMap.get(currentId);
    if (!folder) break;
    
    // Skip system folders in path display
    if (!folder.is_system_folder) {
      path.unshift(folder.name);
    }
    
    currentId = folder.parent_id;
  }

  return path.length > 0 ? path.join(' / ') : '';
};

const FolderTreeNode: React.FC<{
  node: FolderNode;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}> = ({ node, level, selectedId, expandedIds, onToggle, onSelect }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            onToggle(node.id);
          }
          onSelect(node.id);
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left ${
          isSelected
            ? 'bg-boh-primary/10 text-boh-primary'
            : 'hover:bg-boh-surface-light dark:hover:bg-boh-surface text-boh-text-light dark:text-boh-text'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDownIcon className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-3 h-3 flex-shrink-0" />
          )
        ) : (
          <div className="w-3" />
        )}
        <FolderIcon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm truncate">{node.name}</span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <FolderTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FolderTreePicker({
  folders,
  selectedFolderId,
  onSelectFolder,
}: FolderTreePickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tree, setTree] = useState<FolderNode[]>([]);

  useEffect(() => {
    const folderTree = buildFolderTree(folders);
    setTree(folderTree);

    // Auto-expand root folders
    const rootIds = folderTree.map(node => node.id);
    setExpandedIds(new Set(rootIds));
  }, [folders]);

  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (id: string) => {
    const path = buildFolderPath(id, folders);
    onSelectFolder(id, path);
  };

  return (
    <div className="border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-bg-light dark:bg-boh-bg max-h-80 overflow-y-auto">
      {tree.length === 0 ? (
        <div className="p-4 text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          No folders available
        </div>
      ) : (
        <div className="py-2">
          {tree.map(node => (
            <FolderTreeNode
              key={node.id}
              node={node}
              level={0}
              selectedId={selectedFolderId}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
