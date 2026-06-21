import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { WhiteboardCard, WhiteboardItem } from '../types';

export interface GroupedWhiteboardItems {
  [cardId: string]: WhiteboardItem[];
}

interface UseWhiteboardBoardResult {
  cards: WhiteboardCard[];
  itemsByCard: GroupedWhiteboardItems;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  deleteItem: (itemId: string) => void;
}

export function useWhiteboardBoard(): UseWhiteboardBoardResult {
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [itemsByCard, setItemsByCard] = useState<GroupedWhiteboardItems>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch active cards ordered by sort_order
      const { data: cardsData, error: cardsError } = await supabase
        .from('keep_whiteboard_card')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (cardsError) {
        // If cards table doesn't exist, treat as no cards
        if (isTableNotFoundError(cardsError)) {
          setCards([]);
          setItemsByCard({});
          setLoading(false);
          return;
        }
        throw cardsError;
      }

      const activeCards = cardsData || [];
      setCards(activeCards);

      // Fetch all items
      const { data: itemsData, error: itemsError } = await supabase
        .from('keep_whiteboard_item')
        .select('*')
        .order('created_at', { ascending: false });

      if (itemsError) {
        // If items table doesn't exist, treat as empty
        if (isTableNotFoundError(itemsError)) {
          setItemsByCard({});
          setLoading(false);
          return;
        }
        throw itemsError;
      }

      // Group items by card_id
      const allItems = itemsData || [];
      const grouped: GroupedWhiteboardItems = {};

      // Initialize empty arrays for all cards
      activeCards.forEach((card) => {
        grouped[card.id] = [];
      });

      // Add an "uncategorized" group for items without a card
      grouped['uncategorized'] = [];

      // Group items
      allItems.forEach((item) => {
        const cardId = item.card_id || 'uncategorized';
        if (!grouped[cardId]) {
          grouped[cardId] = [];
        }
        grouped[cardId].push(item);
      });

      setItemsByCard(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load whiteboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optimistic delete - removes item from local state immediately without full refresh
  const deleteItem = useCallback((itemId: string) => {
    setItemsByCard((prev) => {
      const updated: GroupedWhiteboardItems = {};
      for (const [cardId, items] of Object.entries(prev)) {
        updated[cardId] = (items as WhiteboardItem[]).filter((item) => item.id !== itemId);
      }
      return updated;
    });
  }, []);

  return { cards, itemsByCard, loading, error, refresh: fetchData, deleteItem };
}

function isTableNotFoundError(error: any): boolean {
  return error.code === '404' || 
         error.code === '42P01' ||
         error.code === 'PGRST116' ||
         (error.message && error.message.includes('relation') && error.message.includes('does not exist'));
}

interface CreateWhiteboardItemInput {
  title: string;
  description: string;
  cardId: string;
}

export async function createWhiteboardItem(
  input: CreateWhiteboardItemInput,
  userId: string
): Promise<WhiteboardItem | null> {
  const { data, error } = await supabase
    .from('keep_whiteboard_item')
    .insert({
      card_id: input.cardId,
      title: input.title,
      description: input.description || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create whiteboard item:', error);
    return null;
  }

  return data;
}

interface UpdateWhiteboardItemInput {
  title?: string;
  description?: string;
  card_id?: string | null;
}

export async function updateWhiteboardItem(
  id: string,
  input: UpdateWhiteboardItemInput
): Promise<WhiteboardItem | null> {
  const { data, error } = await supabase
    .from('keep_whiteboard_item')
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update whiteboard item:', error);
    return null;
  }

  return data;
}

export async function deleteWhiteboardItem(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('keep_whiteboard_item')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete whiteboard item:', error);
    return false;
  }

  return true;
}

/**
 * Move a whiteboard item to a different card/lane
 * This is a convenience wrapper around updateWhiteboardItem for semantic clarity
 */
export async function moveWhiteboardItem(
  itemId: string,
  targetCardId: string | null
): Promise<WhiteboardItem | null> {
  return updateWhiteboardItem(itemId, { card_id: targetCardId });
}
