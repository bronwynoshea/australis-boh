import React from 'react';
import { BriefcaseIcon, CrownIcon, SettingsIcon, BoxIcon, TargetIcon } from './Icons';
import type { KeepSection } from '../types';

interface SectionSelectorProps {
  sections: KeepSection[];
  currentSection: string | null;
  onSectionChange: (sectionSlug: string) => void;
  loading?: boolean;
}

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  commercial: BriefcaseIcon,
  executive: CrownIcon,
  operations: SettingsIcon,
  product: BoxIcon,
  strategy: TargetIcon,
};

export default function SectionSelector({
  sections,
  currentSection,
  onSectionChange,
  loading,
}: SectionSelectorProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-boh-surface-light dark:bg-boh-surface animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sections.map((section) => {
        const Icon = SECTION_ICONS[section.section_slug] || BoxIcon;
        const isActive = currentSection === section.section_slug;

        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.section_slug)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-lg
              transition-all duration-200
              ${isActive
                ? 'bg-boh-primary text-white shadow-md'
                : 'hover:bg-boh-surface-light dark:hover:bg-boh-surface text-boh-text-light dark:text-boh-text'
              }
            `}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 text-left">
              <div className="font-medium">{section.label}</div>
              <div className={`text-xs ${isActive ? 'text-white/80' : 'text-boh-text-sub-light dark:text-boh-text-sub'}`}>
                {section.access_level === 'all' && 'All users'}
                {section.access_level === 'section_admins' && 'Section admins'}
                {section.access_level === 'super_admin_only' && 'Super admin only'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
