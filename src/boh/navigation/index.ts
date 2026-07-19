// Navigation exports
export { default as AppRail } from './AppRail';
export { default as ContextualSidebar } from './ContextualSidebar';
export { default as BOHShell } from '../layouts/BOHShell';
export { useBohNavigation, useAppNavConfig } from './useBohNavigation';
export { DefaultIcons } from './AppRail';

// Configs
export {
  bohApps,
  menuNavConfig,
  tablezNavConfig,
  cookbookNavConfig,
  funnelNavConfig,
  patronNavConfig,
  counterNavConfig,
  forgeNavConfig,
  ledgerNavConfig,
  crewNavConfig,
  chatzNavConfig,
  studioNavConfig,
  talentNavConfig,
  keepNavConfig,
  loftNavConfig,
  cellarNavConfig,
  assemblyNavConfig,
  getAppById,
  getAppByRoute,
} from './appConfigs';

// Types
export type {
  SidebarNavItem,
  SidebarNavGroup,
  AppNavConfig,
  BohAppDefinition,
  BohNavigationState,
  NavItemOrGroup,
} from './types';
export { isNavGroup, isNavItem } from './types';
