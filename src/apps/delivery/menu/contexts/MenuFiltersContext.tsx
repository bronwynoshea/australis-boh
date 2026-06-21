import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ProductFilters } from '../../../../hooks/useProductData';

export type MenuFilters = ProductFilters & {
  module_id?: string | null;
  planning_stage_id?: string;
  priority_id?: string;
  has_release?: boolean | null;
  has_tickets?: boolean | null;
};

type MenuFiltersContextValue = {
  filters: MenuFilters;
  updateFilters: (updates: Partial<MenuFilters>) => void;
  resetFilters: () => void;
};

const MenuFiltersContext = createContext<MenuFiltersContextValue | undefined>(undefined);

const getInitialFilters = (): MenuFilters => ({});

export const MenuFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<MenuFilters>(getInitialFilters);

  const contextValue = useMemo<MenuFiltersContextValue>(() => ({
    filters,
    updateFilters: (updates) =>
      setFilters((prev) => ({
        ...prev,
        ...updates,
      })),
    resetFilters: () => setFilters(getInitialFilters()),
  }), [filters]);

  return (
    <MenuFiltersContext.Provider value={contextValue}>
      {children}
    </MenuFiltersContext.Provider>
  );
};

export const useMenuFilters = (): MenuFiltersContextValue => {
  const ctx = useContext(MenuFiltersContext);
  if (!ctx) {
    throw new Error('useMenuFilters must be used within a MenuFiltersProvider');
  }
  return ctx;
};
