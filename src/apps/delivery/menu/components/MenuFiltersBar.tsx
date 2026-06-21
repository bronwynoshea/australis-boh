import React, { useMemo } from 'react';
import { useMenuFilters } from '../contexts/MenuFiltersContext';
import {
  useProductApps,
  useAppModules,
  usePlanningStages,
  usePriorityOptions,
} from '../../../../hooks/useProductData';
import { useBohUsers } from '../../../../hooks/useBohUsers';
import FilterDropdown from '../../shared/components/FilterDropdown';

const QUARTERS: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'> = ['Q1', 'Q2', 'Q3', 'Q4'];

const ToggleChip: React.FC<{
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full border text-sm font-medium transition-colors ${
      active
        ? 'bg-boh-primary/10 border-boh-primary text-boh-primary'
        : 'border-boh-border-light dark:border-boh-border text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text'
    }`}
  >
    {children}
  </button>
);

const MenuFiltersBar: React.FC = () => {
  const { filters, updateFilters, resetFilters } = useMenuFilters();
  const { data: apps = [] } = useProductApps();
  const { data: modules = [] } = useAppModules(filters.app_id);
  const { data: planningStages = [] } = usePlanningStages();
  const { data: priorities = [] } = usePriorityOptions();
  const { users: owners = [], isLoading: ownersLoading } = useBohUsers();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, idx) => currentYear - 1 + idx);
  }, []);

  const appOptions = useMemo(() => [
    { label: 'All apps', value: undefined },
    ...apps.map((app) => ({ label: app.name, value: app.id, description: app.slug })),
  ], [apps]);

  const moduleOptions = useMemo(() => [
    { label: 'All modules', value: undefined },
    { label: 'No module', value: null },
    ...(modules?.map((module) => ({ label: module.label, value: module.id })) ?? []),
  ], [modules]);

  const ownerOptions = useMemo(() => [
    { label: 'All owners', value: undefined },
    ...owners.map((owner) => ({ label: owner.full_name || owner.email || 'Unnamed', value: owner.id })),
  ], [owners]);

  const planningStageOptions = useMemo(() => [
    { label: 'All stages', value: undefined },
    ...planningStages.map((stage) => ({ label: stage.label, value: stage.id })),
  ], [planningStages]);

  const quarterOptions = useMemo(() => [
    { label: 'All quarters', value: undefined },
    ...QUARTERS.map((quarter) => ({ label: quarter, value: quarter })),
  ], []);

  const yearOptionsDropdown = useMemo(() => [
    { label: 'All years', value: undefined },
    ...yearOptions.map((year) => ({ label: String(year), value: year })),
  ], [yearOptions]);

  const priorityOptions = useMemo(() => [
    { label: 'All priorities', value: undefined },
    ...priorities.map((priority) => ({ label: priority.label, value: priority.id })),
  ], [priorities]);

  return (
    <div className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          label="App"
          options={appOptions}
          displayValue={apps.find((app) => app.id === filters.app_id)?.name}
          onSelect={(value) => updateFilters({ app_id: value as string | undefined, module_id: undefined })}
        />

        <FilterDropdown
          label="Module"
          options={moduleOptions}
          displayValue={modules?.find((module) => module.id === filters.module_id)?.label || (filters.module_id === null ? 'No module' : undefined)}
          placeholder={filters.app_id ? 'All modules' : 'Select app first'}
          onSelect={(value) => updateFilters({ module_id: value === null ? null : (value as string | undefined) })}
          disabled={!filters.app_id}
        />

        <FilterDropdown
          label="Owner"
          options={ownerOptions}
          displayValue={owners.find((owner) => owner.id === filters.owner_user_id)?.full_name || owners.find((owner) => owner.id === filters.owner_user_id)?.email}
          onSelect={(value) => updateFilters({ owner_user_id: value as string | undefined })}
          disabled={ownersLoading}
        />

        <FilterDropdown
          label="Stage"
          options={planningStageOptions}
          displayValue={planningStages.find((stage) => stage.id === filters.planning_stage_id)?.label}
          onSelect={(value) => updateFilters({ planning_stage_id: value as string | undefined })}
        />

        <FilterDropdown
          label="Quarter"
          options={quarterOptions}
          displayValue={filters.quarter || undefined}
          onSelect={(value) => updateFilters({ quarter: value as 'Q1' | 'Q2' | 'Q3' | 'Q4' | undefined })}
        />

        <FilterDropdown
          label="Year"
          options={yearOptionsDropdown}
          displayValue={filters.year ? String(filters.year) : undefined}
          onSelect={(value) => updateFilters({ year: value as number | undefined })}
        />

        <FilterDropdown
          label="Priority"
          options={priorityOptions}
          displayValue={priorities.find((priority) => priority.id === filters.priority_id)?.label}
          onSelect={(value) => updateFilters({ priority_id: value as string | undefined })}
        />

        <div className="flex flex-wrap gap-2">
          <ToggleChip
            active={filters.has_release === true}
            onClick={() => updateFilters({ has_release: filters.has_release === true ? undefined : true })}
          >
            Has release
          </ToggleChip>
          <ToggleChip
            active={filters.has_release === false}
            onClick={() => updateFilters({ has_release: filters.has_release === false ? undefined : false })}
          >
            No release
          </ToggleChip>
          <ToggleChip
            active={filters.has_tickets === true}
            onClick={() => updateFilters({ has_tickets: filters.has_tickets === true ? undefined : true })}
          >
            Has tickets
          </ToggleChip>
          <ToggleChip
            active={filters.has_tickets === false}
            onClick={() => updateFilters({ has_tickets: filters.has_tickets === false ? undefined : false })}
          >
            No tickets
          </ToggleChip>
        </div>

        <button
          type="button"
          onClick={resetFilters}
          className="ml-auto text-sm font-semibold text-boh-primary hover:text-boh-primary/80"
        >
          Reset
        </button>
      </div>

      <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub mt-3">
        Initiatives should remain strategic and bounded — generally one quarter of concentrated effort.
      </p>
    </div>
  );
}
;

export default MenuFiltersBar;
