import type { BohAppDefinition, AppNavConfig } from './types';
import { DefaultIcons } from './AppRail';

const getExternalAppUrl = (prodUrl: string, devUrl: string) => {
  if (typeof window === 'undefined') return prodUrl;
  const hostname = window.location.hostname;
  const isDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'dev-boh.jobzcafe.com' ||
    hostname === 'dev-boh.australis.cloud' ||
    hostname === 'boh.australis.cloud';

  return isDev ? devUrl : prodUrl;
};

// Menu App Navigation Config
export const menuNavConfig: AppNavConfig = {
  appId: 'menu',
  appLabel: 'Menu',
  appIcon: DefaultIcons.Menu,
  baseRoute: '/menu',
  defaultRoute: '/menu/overview',
  sidebarItems: [
    { key: 'overview', label: 'Overview', to: '/menu/overview' },
    { key: 'offering', label: 'Product Offering', to: '/menu/offering' },
    { key: 'board', label: 'Pipeline', to: '/menu/board' },
    { key: 'timeline', label: 'Timeline', to: '/menu/timeline' },
    { key: 'archive', label: 'Archive', to: '/menu/archive' },
    { key: 'reports', label: 'Reports', to: '/menu/reports' },
  ],
};

// Assembly App Navigation Config
export const assemblyNavConfig: AppNavConfig = {
  appId: 'assembly',
  appLabel: 'Assembly',
  appIcon: DefaultIcons.Keep,
  baseRoute: '/assembly',
  defaultRoute: '/assembly/overview',
  sidebarItems: [
    { key: 'overview', label: 'Overview', to: '/assembly/overview' },
    { key: 'memos', label: 'Memos', to: '/assembly/memos' },
    { key: 'meetings', label: 'Meetings', to: '/assembly/meetings' },
    { key: 'governance', label: 'Governance', to: '/assembly/governance' },
    { key: 'reviews', label: 'Reviews', to: '/assembly/reviews' },
    { key: 'outcomes', label: 'Outcomes & Tasks', to: '/assembly/outcomes' },
  ],
};

// Tablez App Navigation Config
export const tablezNavConfig: AppNavConfig = {
  appId: 'tablez',
  appLabel: 'Tablez',
  appIcon: DefaultIcons.Tablez,
  baseRoute: '/tablez',
  defaultRoute: '/tablez',
  sidebarItems: [
    { key: 'home', label: 'Home', to: '/tablez' },
    { key: 'dashboard', label: 'Board', to: '/tablez/dashboard' },
    { key: 'today', label: 'Today', to: '/tablez/today' },
    { key: 'projects', label: 'Projects', to: '/tablez/projects' },
    { key: 'admin', label: 'Admin', to: '/tablez/admin' },
  ],
};

// Cookbook App Navigation Config
export const cookbookNavConfig: AppNavConfig = {
  appId: 'cookbook',
  appLabel: 'Cookbook',
  appIcon: DefaultIcons.Cookbook,
  baseRoute: '/cookbook',
  defaultRoute: '/cookbook',
  sidebarItems: [
    {
      label: 'Library',
      items: [
        { key: 'playbooks', label: 'Playbooks', to: '/cookbook' },
        { key: 'templates', label: 'Templates', to: '/cookbook/templates' },
      ],
    },
    {
      label: 'Projects',
      items: [
        { key: 'storyboard', label: 'Storyboard', to: '/cookbook/storyboard' },
        { key: 'assets', label: 'Assets', to: '/cookbook/assets' },
      ],
    },
  ],
};

// Patron App Navigation Config
export const patronNavConfig: AppNavConfig = {
  appId: 'patron',
  appLabel: 'Patron',
  appIcon: DefaultIcons.Patron,
  baseRoute: '/patron',
  defaultRoute: '/patron/dashboard',
  sidebarItems: [
    { key: 'dashboard', label: 'Dashboard', to: '/patron/dashboard' },
    { key: 'people', label: 'People', to: '/patron/people' },
    { key: 'organisations', label: 'Organisations', to: '/patron/organisations' },
    { key: 'pipeline', label: 'Pipeline', to: '/patron/pipeline' },
  ],
};

// Counter App Navigation Config
export const counterNavConfig: AppNavConfig = {
  appId: 'counter',
  appLabel: 'Counter',
  appIcon: DefaultIcons.Counter,
  baseRoute: '/counter',
  defaultRoute: '/counter/dashboard',
  sidebarItems: [
    { key: 'dashboard', label: 'Dashboard', to: '/counter/dashboard' },
    { key: 'inbox', label: 'Inbox', to: '/counter/inbox' },
    { key: 'my', label: 'My Tickets', to: '/counter/my' },
    { key: 'all', label: 'All Tickets', to: '/counter/all' },
    { key: 'new', label: 'New Ticket', to: '/counter/new' },
    { key: 'agents', label: 'Agents', to: '/counter/agents' },
    { key: 'settings', label: 'Settings', to: '/counter/settings' },
  ],
};

// Forge App Navigation Config
export const forgeNavConfig: AppNavConfig = {
  appId: 'forge',
  appLabel: 'Forge',
  appIcon: DefaultIcons.Forge,
  baseRoute: '/forge',
  defaultRoute: '/forge',
  sidebarItems: [
    { key: 'overview', label: 'Overview', to: '/forge' },
    { key: 'intake', label: 'Intake', to: '/forge/intake' },
    { key: 'workstreams', label: 'Workstreams', to: '/forge/workstreams' },
    {
      label: 'Releases',
      items: [
        { key: 'external-releases', label: 'External', to: '/forge/external-releases' },
        { key: 'internal-releases', label: 'Internal', to: '/forge/internal-releases' },
      ],
    },
    { key: 'reports', label: 'Reports', to: '/forge/reports' },
    { key: 'expo', label: 'Expo', to: '/forge/expo' },
  ],
};

// Ledger App Navigation Config
export const ledgerNavConfig: AppNavConfig = {
  appId: 'ledger',
  appLabel: 'Ledger',
  appIcon: DefaultIcons.Ledger,
  baseRoute: '/ledger',
  defaultRoute: '/ledger',
  sidebarItems: [
    { key: 'dashboard', label: 'Dashboard', to: '/ledger' },
    { key: 'transactions', label: 'Transactions', to: '/ledger/transactions' },
    { key: 'invoices', label: 'Invoices', to: '/ledger/invoices' },
    { key: 'reports', label: 'Reports', to: '/ledger/reports' },
  ],
};

// Crew App Navigation Config
export const crewNavConfig: AppNavConfig = {
  appId: 'crew',
  appLabel: 'Crew',
  appIcon: DefaultIcons.Crew,
  baseRoute: '/crew',
  defaultRoute: '/crew',
  sidebarItems: [
    { key: 'directory', label: 'Directory', to: '/crew' },
    { key: 'access', label: 'Team & Access', to: '/boh/access' },
    { key: 'teams', label: 'Teams', to: '/crew/teams' },
    { key: 'schedule', label: 'Schedule', to: '/crew/schedule' },
    { key: 'skills', label: 'Skills', to: '/crew/skills' },
  ],
};

// Chatz App Navigation Config
export const chatzNavConfig: AppNavConfig = {
  appId: 'chatz',
  appLabel: 'Chatz',
  appIcon: DefaultIcons.Chatz,
  baseRoute: '/apps/chatz',
  defaultRoute: '/apps/chatz',
  sidebarItems: [
    { key: 'conversations', label: 'Conversations', to: '/apps/chatz' },
    { key: 'contacts', label: 'Contacts', to: '/apps/chatz/contacts' },
    { key: 'settings', label: 'Settings', to: '/apps/chatz/settings' },
  ],
};

// Studio App Navigation Config
export const studioNavConfig: AppNavConfig = {
  appId: 'studio',
  appLabel: 'Studio',
  appIcon: DefaultIcons.Studio,
  baseRoute: '/studio',
  defaultRoute: '/studio',
  sidebarItems: [
    { key: 'dashboard', label: 'Dashboard', to: '/studio' },
    { key: 'projects', label: 'Projects', to: '/studio/projects' },
    { key: 'media', label: 'Media', to: '/studio/media' },
  ],
};

// Talent App Navigation Config
export const talentNavConfig: AppNavConfig = {
  appId: 'talent',
  appLabel: 'Talent',
  appIcon: DefaultIcons.Talent,
  baseRoute: '/talent',
  defaultRoute: '/talent',
  sidebarItems: [
    { key: 'pool', label: 'Talent Pool', to: '/talent' },
    { key: 'jobs', label: 'Job Requisitions', to: '/talent/jobs' },
    { key: 'applications', label: 'Applications', to: '/talent/applications' },
  ],
};

// Slotz App Navigation Config
export const slotzNavConfig: AppNavConfig = {
  appId: 'slotz',
  appLabel: 'Slotz',
  appIcon: DefaultIcons.Slotz,
  baseRoute: '/apps/slotz',
  defaultRoute: '/apps/slotz',
  sidebarItems: [
    { key: 'calendar', label: 'Calendar', to: '/apps/slotz' },
    { key: 'availability', label: 'Availability', to: '/apps/slotz/availability' },
    { key: 'settings', label: 'Settings', to: '/apps/slotz/settings' },
  ],
};

// Keep App Navigation Config
export const keepNavConfig: AppNavConfig = {
  appId: 'keep',
  appLabel: 'Keep',
  appIcon: DefaultIcons.Keep,
  baseRoute: '/keep',
  defaultRoute: '/keep',
  sidebarItems: [
    {
      label: 'Thinking',
      items: [
        { key: 'whiteboard', label: 'Whiteboard', to: '/keep/whiteboard' },
      ],
    },
    {
      label: 'Work',
      items: [
        { key: 'workspace', label: 'Workspace', to: '/keep/workspace' },
      ],
    },
    {
      label: 'Knowledge',
      items: [
        { key: 'gold-library', label: 'Gold Library', to: '/keep/gold-library' },
      ],
    },
  ],
};

// Loft App Navigation Config
export const loftNavConfig: AppNavConfig = {
  appId: 'loft',
  appLabel: 'Loft',
  appIcon: DefaultIcons.Loft,
  baseRoute: '/apps/loft',
  defaultRoute: '/apps/loft',
  sidebarItems: [
    { key: 'overview', label: 'Overview', to: '/apps/loft' },
    { key: 'personal-room', label: 'Personal Room', to: '/apps/loft#/personal-room' },
  ],
};

// Website App Navigation Config
export const websiteNavConfig: AppNavConfig = {
  appId: 'website',
  appLabel: 'Website',
  appIcon: DefaultIcons.Generic,
  baseRoute: '/website',
  defaultRoute: '/website',
  sidebarItems: [
    { key: 'preview', label: 'Preview', to: '/website' },
  ],
};

// Cellar App Navigation Config
export const cellarNavConfig: AppNavConfig = {
  appId: 'cellar',
  appLabel: 'Cellar',
  appIcon: DefaultIcons.Cellar,
  baseRoute: '/cellar',
  defaultRoute: '/cellar',
  sidebarItems: [
    { key: 'overview', label: 'Overview', to: '/cellar' },
  ],
};

// All BOH App Definitions
export const bohApps: BohAppDefinition[] = [
  {
    id: 'assembly',
    slug: 'assembly',
    name: 'Assembly',
    route: '/assembly',
    icon: DefaultIcons.Keep,
    navConfig: assemblyNavConfig,
    category: 'internal',
  },
  {
    id: 'cellar',
    slug: 'cellar',
    name: 'Cellar',
    route: '/cellar',
    icon: DefaultIcons.Cellar,
    navConfig: cellarNavConfig,
    category: 'internal',
  },

  {
    id: 'chatz',
    slug: 'chatz',
    name: 'Chatz',
    route: '/apps/chatz',
    icon: DefaultIcons.Chatz,
    navConfig: chatzNavConfig,
    isExternal: true,
    externalUrl: 'https://chatz.jobz.cafe',
    category: 'hybrid',
  },
  {
    id: 'cookbook',
    slug: 'cookbook',
    name: 'Cookbook',
    route: '/cookbook',
    icon: DefaultIcons.Cookbook,
    navConfig: cookbookNavConfig,
    category: 'internal',
  },
  {
    id: 'counter',
    slug: 'counter',
    name: 'Counter',
    route: '/counter',
    icon: DefaultIcons.Counter,
    navConfig: counterNavConfig,
    category: 'internal',
  },
  {
    id: 'crew',
    slug: 'crew',
    name: 'Crew',
    route: '/crew',
    icon: DefaultIcons.Crew,
    navConfig: crewNavConfig,
    category: 'internal',
  },
  {
    id: 'forge',
    slug: 'forge',
    name: 'Forge',
    route: '/forge',
    icon: DefaultIcons.Forge,
    navConfig: forgeNavConfig,
    category: 'internal',
  },
  {
    id: 'keep',
    slug: 'keep',
    name: 'Keep',
    route: '/keep',
    icon: DefaultIcons.Keep,
    navConfig: keepNavConfig,
    category: 'internal',
  },
  {
    id: 'ledger',
    slug: 'ledger',
    name: 'Ledger',
    route: '/ledger',
    icon: DefaultIcons.Ledger,
    navConfig: ledgerNavConfig,
    category: 'internal',
  },
  {
    id: 'loft',
    slug: 'loft',
    name: 'Loft',
    route: '/apps/loft',
    icon: DefaultIcons.Loft,
    navConfig: loftNavConfig,
    category: 'internal',
  },
  {
    id: 'menu',
    slug: 'menu',
    name: 'Menu',
    route: '/menu',
    icon: DefaultIcons.Menu,
    navConfig: menuNavConfig,
    category: 'internal',
  },
  {
    id: 'patron',
    slug: 'patron',
    name: 'Patron',
    route: '/patron',
    icon: DefaultIcons.Patron,
    navConfig: patronNavConfig,
    category: 'internal',
  },
  {
    id: 'slotz',
    slug: 'slotz',
    name: 'Slotz',
    route: '/apps/slotz',
    icon: DefaultIcons.Slotz,
    navConfig: slotzNavConfig,
    category: 'internal',
  },
  {
    id: 'tablez',
    slug: 'tablez',
    name: 'Tablez & Chairz',
    route: '/tablez',
    icon: DefaultIcons.Tablez,
    navConfig: tablezNavConfig,
    category: 'internal',
  },
  {
    id: 'website',
    slug: 'website',
    name: 'Website',
    route: '/website',
    icon: DefaultIcons.Generic,
    navConfig: websiteNavConfig,
    category: 'customer',
  },
];

// Get app by ID
export const getAppById = (id: string): BohAppDefinition | undefined => {
  return bohApps.find(app => app.id === id);
};

// Get app by route
export const getAppByRoute = (route: string): BohAppDefinition | undefined => {
  return bohApps.find(app => app.route && route.startsWith(app.route));
};
