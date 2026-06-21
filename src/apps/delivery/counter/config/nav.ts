// Shared navigation configuration for Counter module - SINGLE SOURCE OF TRUTH
import type { FC } from 'react';
import type { Page } from '../types';
import { DashboardIcon, InboxIcon, TicketIcon, PlusCircleIcon, SettingsIcon, MoreIcon, AgentsIcon } from '../components/Icons';

// Single source of truth for Counter routes
export const COUNTER_ROUTES = {
  dashboard: { path: '/counter/dashboard', label: 'Dashboard', page: 'Dashboard' as Page },
  inbox: { path: '/counter/inbox', label: 'Inbox', page: 'Inbox' as Page },
  my: { path: '/counter/my', label: 'My Tickets', page: 'My Tickets' as Page },
  all: { path: '/counter/all', label: 'All Tickets', page: 'All Tickets' as Page },
  new: { path: '/counter/new', label: 'New Ticket', page: 'New Ticket' as Page },
  agents: { path: '/counter/agents', label: 'Agents', page: 'Agents' as Page },
  settings: { path: '/counter/settings', label: 'Settings', page: 'Settings' as Page },
} as const;

// Relative paths for use within CounterApp (without /counter prefix)
const RELATIVE_PATHS = {
  dashboard: 'dashboard',
  inbox: 'inbox',
  my: 'my',
  all: 'all',
  new: 'new',
  agents: 'agents',
  settings: 'settings',
} as const;

export interface NavItem {
  page: Page;
  icon: FC<{ className?: string }>;
  label: string;
  path: string; // Relative path for use within CounterApp
  routeKey: keyof typeof COUNTER_ROUTES;
}

// All navigation items for Counter (desktop sidebar)
export const COUNTER_NAV_ITEMS: NavItem[] = [
  { page: 'Dashboard', icon: DashboardIcon, label: 'Dashboard', path: RELATIVE_PATHS.dashboard, routeKey: 'dashboard' },
  { page: 'Inbox', icon: InboxIcon, label: 'Inbox', path: RELATIVE_PATHS.inbox, routeKey: 'inbox' },
  { page: 'My Tickets', icon: TicketIcon, label: 'My Tickets', path: RELATIVE_PATHS.my, routeKey: 'my' },
  { page: 'All Tickets', icon: MoreIcon, label: 'All Tickets', path: RELATIVE_PATHS.all, routeKey: 'all' },
  { page: 'New Ticket', icon: PlusCircleIcon, label: 'New Ticket', path: RELATIVE_PATHS.new, routeKey: 'new' },
  { page: 'Agents', icon: AgentsIcon, label: 'Agents', path: RELATIVE_PATHS.agents, routeKey: 'agents' },
  { page: 'Settings', icon: SettingsIcon, label: 'Settings', path: RELATIVE_PATHS.settings, routeKey: 'settings' },
];

// Main nav items for mobile bottom navigation
// Dashboard → Counter dashboard
// Tickets → Counter inbox (Inbox by default)
// New → New Ticket
// More → Menu for My Tickets, All Tickets, Agents, Settings
export const COUNTER_MAIN_NAV_ITEMS: NavItem[] = [
  { page: 'Dashboard', icon: DashboardIcon, label: 'Dashboard', path: RELATIVE_PATHS.dashboard, routeKey: 'dashboard' },
  { page: 'Inbox', icon: TicketIcon, label: 'Tickets', path: RELATIVE_PATHS.inbox, routeKey: 'inbox' },
  { page: 'New Ticket', icon: PlusCircleIcon, label: 'New', path: RELATIVE_PATHS.new, routeKey: 'new' },
];

// Secondary nav items for mobile "More" menu
export const COUNTER_MORE_NAV_ITEMS: NavItem[] = [
  { page: 'My Tickets', icon: TicketIcon, label: 'My Tickets', path: RELATIVE_PATHS.my, routeKey: 'my' },
  { page: 'All Tickets', icon: MoreIcon, label: 'All Tickets', path: RELATIVE_PATHS.all, routeKey: 'all' },
  { page: 'Agents', icon: AgentsIcon, label: 'Agents', path: RELATIVE_PATHS.agents, routeKey: 'agents' },
  { page: 'Settings', icon: SettingsIcon, label: 'Settings', path: RELATIVE_PATHS.settings, routeKey: 'settings' },
];

