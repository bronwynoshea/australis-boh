import type { ReactNode, ComponentType } from 'react';

export interface SidebarNavItem {
  key: string;
  label: string;
  to: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: number | string;
  disabled?: boolean;
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

export interface AppNavConfig {
  appId: string;
  appLabel: string;
  appIcon: ComponentType<{ className?: string }>;
  baseRoute: string;
  sidebarItems: (SidebarNavItem | SidebarNavGroup)[];
  defaultRoute?: string;
}

export interface BohAppDefinition {
  id: string;
  slug: string;
  name: string;
  route: string;
  icon: ComponentType<{ className?: string }>;
  navConfig?: AppNavConfig;
  isExternal?: boolean;
  externalUrl?: string;
  category?: 'internal' | 'hybrid' | 'customer';
  disabled?: boolean;
}

export interface BohNavigationState {
  activeAppId: string | null;
  activeNavItem: string | null;
  isMobileMenuOpen: boolean;
}

export type NavItemOrGroup = SidebarNavItem | SidebarNavGroup;

export function isNavGroup(item: NavItemOrGroup): item is SidebarNavGroup {
  return 'items' in item && Array.isArray(item.items);
}

export function isNavItem(item: NavItemOrGroup): item is SidebarNavItem {
  return 'to' in item && typeof item.to === 'string';
}
