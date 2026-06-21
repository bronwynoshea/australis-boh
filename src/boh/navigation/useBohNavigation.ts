import { useMemo } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import type { BohAppDefinition, AppNavConfig } from './types';

export function useBohNavigation(apps: BohAppDefinition[]) {
  const location = useLocation();
  const pathname = location.pathname;

  const activeApp = useMemo(() => {
    // Sort by longest base route first for proper matching
    const sortedApps = [...apps].sort((a, b) => 
      b.route.length - a.route.length
    );
    
    for (const app of sortedApps) {
      // Skip external apps
      if (app.isExternal) continue;
      
      // Check if current path matches this app's route
      const match = matchPath(
        { path: `${app.route}/*`, end: false },
        pathname
      );
      
      if (match) {
        return app;
      }
    }
    
    return null;
  }, [apps, pathname]);

  const activeNavItem = useMemo(() => {
    if (!activeApp?.navConfig) return null;
    
    const { sidebarItems } = activeApp.navConfig;
    
    // Flatten items and groups to find the active one
    const allItems = sidebarItems.flatMap(item => {
      if ('items' in item) {
        return item.items;
      }
      return item;
    });
    
    // Find exact match first
    const exactMatch = allItems.find(item => item.to === pathname);
    if (exactMatch) return exactMatch.key;
    
    // Find partial match (for nested routes)
    const partialMatch = allItems.find(item => 
      pathname.startsWith(item.to) && item.to !== activeApp.route
    );
    if (partialMatch) return partialMatch.key;
    
    // Check if at base route
    if (pathname === activeApp.route || pathname === `${activeApp.route}/`) {
      const defaultItem = allItems.find(item => 
        item.to === activeApp.navConfig?.defaultRoute
      );
      return defaultItem?.key || allItems[0]?.key || null;
    }
    
    return null;
  }, [activeApp, pathname]);

  const isActiveRoute = useMemo(() => {
    return (appId: string, navKey?: string): boolean => {
      if (activeApp?.id !== appId) return false;
      if (!navKey) return true;
      return activeNavItem === navKey;
    };
  }, [activeApp, activeNavItem]);

  return {
    activeApp,
    activeNavItem,
    isActiveRoute,
    pathname,
  };
}

export function useAppNavConfig(navConfig: AppNavConfig | undefined) {
  const location = useLocation();
  const pathname = location.pathname;

  const activeItemKey = useMemo(() => {
    if (!navConfig) return null;

    const { sidebarItems, baseRoute, defaultRoute } = navConfig;
    
    // Flatten items
    const allItems = sidebarItems.flatMap(item => {
      if ('items' in item) return item.items;
      return item;
    });

    // Exact match
    const exactMatch = allItems.find(item => item.to === pathname);
    if (exactMatch) return exactMatch.key;

    // Partial match
    const partialMatch = allItems.find(item => 
      pathname.startsWith(item.to) && item.to !== baseRoute
    );
    if (partialMatch) return partialMatch.key;

    // Default route
    if ((pathname === baseRoute || pathname === `${baseRoute}/`) && defaultRoute) {
      const defaultItem = allItems.find(item => item.to === defaultRoute);
      return defaultItem?.key || allItems[0]?.key;
    }

    return allItems[0]?.key || null;
  }, [navConfig, pathname]);

  return {
    activeItemKey,
    config: navConfig,
  };
}
