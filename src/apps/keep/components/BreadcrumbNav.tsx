import React from 'react';
import { ChevronRightIcon, FolderIcon } from './Icons';
import type { BreadcrumbItem } from '../types';

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

export default function BreadcrumbNav({ items, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onNavigate(items[0])}
        className="flex items-center gap-1 px-2 py-1 rounded relative group"
      >
        <FolderIcon className="w-4 h-4" />
        <span className="font-medium text-boh-text-light dark:text-boh-text">
          {items[0]?.name || 'Home'}
        </span>
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-boh-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
      </button>

      {items.slice(1).map((item, index) => (
        <React.Fragment key={item.id}>
          <ChevronRightIcon className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub" />
          <button
            onClick={() => onNavigate(item)}
            className={`
              px-2 py-1 rounded relative group
              ${index === items.length - 2
                ? 'text-boh-text-light dark:text-boh-text font-medium'
                : 'text-boh-text-sub-light dark:text-boh-text-sub'
              }
            `}
          >
            {item.name}
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-boh-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
