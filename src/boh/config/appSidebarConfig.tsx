import React from 'react';
import { DashboardIcon, InboxIcon, TicketIcon, PlusCircleIcon, AgentsIcon } from '../../apps/delivery/counter/components/Icons';

// Board icon for Tablez
const BoardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

// Today icon for Tablez
const TodayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Dashboard icon for BOH
const BohDashboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

// Apps & Access icon
const AppsAccessIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 006-6v-1a3 3 0 00-3-3H9a3 3 0 00-3 3v1a6 6 0 006 6z" />
  </svg>
);

// Team & Invites icon
const TeamInvitesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export type BohNavItem = {
  label: string;
  icon?: React.FC<{ className?: string }>;
  to: string;
};

export type BohAppSidebarConfig = {
  appSlug: 'boh' | 'counter' | 'tablez' | 'patron' | string;
  appLabel: string;              // e.g. 'Counter', 'Tablez & Chairz'
  showAppsSection?: boolean;     // whether to show the global APPS section
  mainNav: BohNavItem[];         // app-specific nav items
};

export const BOH_APP_SIDEBARS: Record<string, BohAppSidebarConfig> = {
  boh: {
    appSlug: 'boh',
    appLabel: 'Back of House',
    showAppsSection: true,
    mainNav: [
      { label: 'Dashboard', icon: BohDashboardIcon, to: '/boh' },
      { label: 'Team & Access', icon: TeamInvitesIcon, to: '/boh/team-access' },
    ],
  },
  counter: {
    appSlug: 'counter',
    appLabel: 'Counter',
    showAppsSection: true,
    mainNav: [
      { label: 'Dashboard', icon: DashboardIcon, to: '/counter/dashboard' },
      { label: 'Inbox', icon: InboxIcon, to: '/counter/inbox' },
      { label: 'My Tickets', icon: TicketIcon, to: '/counter/my' },
      { label: 'All Tickets', icon: TicketIcon, to: '/counter/all' },
      { label: 'New Ticket', icon: PlusCircleIcon, to: '/counter/new' },
      { label: 'Agents', icon: AgentsIcon, to: '/counter/agents' },
      { label: 'Settings', icon: DashboardIcon, to: '/counter/settings' },
    ],
  },
  tablez: {
    appSlug: 'tablez',
    appLabel: 'Tablez & Chairz',
    showAppsSection: true,
    mainNav: [
      { label: 'Board', icon: BoardIcon, to: '/apps/tablez' },
      { label: 'Today', icon: TodayIcon, to: '/apps/tablez/today' },
      { label: 'Projects', icon: BoardIcon, to: '/apps/tablez/projects' },
    ],
  },
  // patron and future BOH tools can be added here
};

