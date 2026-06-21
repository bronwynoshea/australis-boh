// Counter App Constants
// Moved from boh-counter/constants.ts to src/apps/counter/constants.ts

import type { Ticket, Agent, AppKey, CareerModuleKey, TicketSeverity } from './types';
import { InternalPriority, TicketCategory } from './types';

export interface AppOption {
  key: AppKey;
  label: string;
}

export interface CareerModuleOption {
  key: CareerModuleKey;
  label: string;
}

export interface SeverityOption {
  key: TicketSeverity;
  label: string;
  description: string;
  internalPriority: InternalPriority;
}

export const APP_OPTIONS: AppOption[] = [
  { key: 'boh', label: 'BOH' },
  { key: 'career_studio', label: 'Career Studio' },
  { key: 'counter', label: 'Counter' },
  { key: 'talent', label: 'Talent' },
  { key: 'other', label: 'Other' }
];

export const CAREER_MODULE_OPTIONS: CareerModuleOption[] = [
  { key: 'none', label: 'None / General' },
  { key: 'journey', label: 'Journey' },
  { key: 'coach', label: 'Coach' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'other', label: 'Other' }
];

export const CAREER_MODULE_LABELS: Record<CareerModuleKey, string> = {
  none: 'None / General',
  journey: 'Journey',
  coach: 'Coach',
  cafe: 'Cafe',
  other: 'Other'
};

export const SEVERITY_OPTIONS: SeverityOption[] = [
  { 
    key: 'critical' as TicketSeverity, 
    label: 'Completely blocked', 
    description: "I can't work — this is blocking me completely.",
    internalPriority: InternalPriority.Urgent 
  },
  { 
    key: 'high' as TicketSeverity, 
    label: 'Major inconvenience', 
    description: "This is stopping me from doing part of my work.",
    internalPriority: InternalPriority.High 
  },
  { 
    key: 'medium' as TicketSeverity, 
    label: 'Minor inconvenience', 
    description: "It's inconvenient or slowing me down.",
    internalPriority: InternalPriority.Medium 
  },
  { 
    key: 'low' as TicketSeverity, 
    label: 'Nice to have', 
    description: "It's not urgent — a small issue or nice-to-fix.",
    internalPriority: InternalPriority.Low 
  }
];

// Helper function to get user-facing severity label
export function getSeverityLabel(severity: TicketSeverity): string {
  const option = SEVERITY_OPTIONS.find(opt => opt.key === severity);
  return option?.label || 'Nice to have';
}

// App → Feature mapping for 2-step App Area selection
export type AppFeatureGroup = {
  appKey: string;
  appLabel: string;
  features: { key: string; label: string }[];
};

export const APP_FEATURE_GROUPS: AppFeatureGroup[] = [
  {
    appKey: 'cafe',
    appLabel: 'Cafe',
    features: [
      { key: 'beacon', label: 'Beacon' },
      { key: 'booth', label: 'Booth' },
      { key: 'passport', label: 'Passport' },
      { key: 'pathway', label: 'Pathway' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'loft', label: 'Loft' },
    ],
  },
  {
    appKey: 'journey',
    appLabel: 'Journey',
    features: [
      { key: 'journal', label: 'Journal' },
      { key: 'moods', label: 'Moods' },
      { key: 'snapshot', label: 'Snapshot' },
      { key: 'insights', label: 'Insights' },
    ],
  },
  {
    appKey: 'coach',
    appLabel: 'Coach',
    features: [
      { key: 'sessions', label: 'Sessions' },
      { key: 'pathway', label: 'Pathway' },
    ],
  },
  {
    appKey: 'mentor',
    appLabel: 'Mentor',
    features: [{ key: 'sessions', label: 'Sessions' }],
  },
  {
    appKey: 'dna',
    appLabel: 'DNA',
    features: [{ key: 'profile', label: 'Profile' }],
  },
  {
    appKey: 'talent',
    appLabel: 'Talent',
    features: [{ key: 'jobs', label: 'Jobs' }],
  },
  {
    appKey: 'boh',
    appLabel: 'Back of House',
    features: [
      { key: 'counter', label: 'Counter' },
      { key: 'results', label: 'Results' },
      { key: 'tablez', label: 'Tablez' },
      { key: 'cookbook', label: 'Cookbook' },
      { key: 'patron', label: 'Patron' },
    ],
  },
];

// Category options for pill selection
export type CategoryOption = { value: string; label: string };

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: TicketCategory.Bug, label: 'Bug' },
  { value: TicketCategory.FeatureIdea, label: 'Feature idea' },
  { value: TicketCategory.Question, label: 'Question' },
  { value: TicketCategory.AccountIssue, label: 'Account issue' },
  { value: TicketCategory.Other, label: 'Other' },
];

// Helper function to get app area value from app and feature
export function getAppAreaValue(appKey: string, featureKey: string): string {
  return `${appKey}:${featureKey}`;
}

