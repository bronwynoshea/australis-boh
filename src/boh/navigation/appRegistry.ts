import React, { lazy } from 'react';

export type BohAppCategory = 'Operations' | string;

export interface BohAppRegistration {
  slug: string;
  label: string;
  icon: string;
  appPath: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  category: BohAppCategory;
}

export const APP_REGISTRY: BohAppRegistration[] = [
  {
    slug: 'chatz',
    label: 'Chats',
    icon: 'MessageSquareText',
    appPath: '/apps/chatz',
    component: lazy(() => import('../apps/chatz/App')),
    category: 'Operations',
  },
];

