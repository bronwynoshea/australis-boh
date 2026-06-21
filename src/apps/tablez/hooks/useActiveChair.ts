import { useEffect, useMemo, useState } from 'react';
import { fetchActiveChairsForUser, fetchTableForChairTableId, type BohChair, type BohTable } from '../api/tablezContextApi';

const ACTIVE_CHAIR_STORAGE_KEY = 'tablez.activeChairId';

export interface ActiveChairState {
  chairs: BohChair[];
  isLoading: boolean;
  error: string | null;
  activeChairId: string | null;
  setActiveChairId: (chairId: string) => void;
  activeChair: BohChair | null;
  activeTable: BohTable | null;
  activeTableId: string | null;
  activeSectionId: string | null;
}

export function useActiveChair(bohUserId: string | null): ActiveChairState {
  const [chairs, setChairs] = useState<BohChair[]>([]);
  const [activeChairId, setActiveChairIdState] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_CHAIR_STORAGE_KEY);
  });
  const [activeTable, setActiveTable] = useState<BohTable | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeChair = useMemo(() => {
    if (!activeChairId) return null;
    return chairs.find(c => c.id === activeChairId) ?? null;
  }, [activeChairId, chairs]);

  const activeTableId = activeChair?.table_id ?? null;
  const activeSectionId = activeTable?.section_id ?? null;

  const setActiveChairId = (chairId: string) => {
    setActiveChairIdState(chairId);
    localStorage.setItem(ACTIVE_CHAIR_STORAGE_KEY, chairId);
  };

  useEffect(() => {
    let mounted = true;

    async function loadChairs() {
      if (!bohUserId) {
        if (mounted) {
          setChairs([]);
          setActiveTable(null);
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const loaded = await fetchActiveChairsForUser(bohUserId);
        if (!mounted) return;

        setChairs(loaded);

        // Resolve active chair choice:
        // 1) localStorage if still valid
        // 2) primary chair
        // 3) first chair
        const stored = localStorage.getItem(ACTIVE_CHAIR_STORAGE_KEY);
        const storedValid = stored && loaded.some(c => c.id === stored);

        const nextActiveId = storedValid
          ? stored!
          : (loaded.find(c => c.is_primary)?.id ?? loaded[0]?.id ?? null);

        if (nextActiveId) {
          setActiveChairIdState(nextActiveId);
          localStorage.setItem(ACTIVE_CHAIR_STORAGE_KEY, nextActiveId);
        } else {
          setActiveChairIdState(null);
          localStorage.removeItem(ACTIVE_CHAIR_STORAGE_KEY);
        }
      } catch (err) {
        console.error('Error loading chairs:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load chairs');
          setChairs([]);
          setActiveChairIdState(null);
          setActiveTable(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadChairs();

    return () => {
      mounted = false;
    };
  }, [bohUserId]);

  useEffect(() => {
    let mounted = true;

    async function loadTable() {
      if (!activeTableId) {
        if (mounted) setActiveTable(null);
        return;
      }

      const table = await fetchTableForChairTableId(activeTableId);
      if (!mounted) return;
      setActiveTable(table);
    }

    loadTable();

    return () => {
      mounted = false;
    };
  }, [activeTableId]);

  return {
    chairs,
    isLoading,
    error,
    activeChairId,
    setActiveChairId,
    activeChair,
    activeTable,
    activeTableId,
    activeSectionId,
  };
}
