import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { QuickLink } from '../components/CrewLinks';

interface UseQuickLinksOptions {
  area?: 'workspace' | 'gold_library';
}

interface QuickLinkData {
  id: string;
  link_scope: 'crew' | 'user';
  target_type: 'folder' | 'file';
  target_id: string;
  label: string;
  subtitle?: string;
  description?: string;
  sort_order: number;
}

export function useQuickLinks(options: UseQuickLinksOptions = {}) {
  const { area = 'workspace' } = options;

  const [crewLinks, setCrewLinks] = useState<QuickLink[]>([]);
  const [myLinks, setMyLinks] = useState<QuickLink[]>([]);
  const [bohUserId, setBohUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve BOH user + tenant from auth session.
  const resolveBohUserContext = useCallback(async (): Promise<{ bohUserId: string; tenantId: string } | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: bohUser, error } = await supabase
      .from('boh_user')
      .select('id, tenant_id')
      .eq('auth_user_id', user.id)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (error || !bohUser?.tenant_id) {
      console.error('[useQuickLinks] Failed to resolve BOH user context:', error);
      return null;
    }

    return { bohUserId: bohUser.id, tenantId: bohUser.tenant_id };
  }, []);

  const transformQuickLink = (link: QuickLinkData): QuickLink => ({
    id: link.id,
    label: link.label,
    targetType: link.target_type,
    targetId: link.target_id,
    subtitle: link.subtitle,
    description: link.description,
    sortOrder: link.sort_order,
  });

  const fetchQuickLinks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Resolve BOH user + tenant first
      const currentContext = await resolveBohUserContext();
      setBohUserId(currentContext?.bohUserId ?? null);
      setTenantId(currentContext?.tenantId ?? null);

      if (!currentContext) {
        throw new Error('Failed to resolve BOH tenant context');
      }

      // Fetch crew links for the current tenant.
      const { data: crewData, error: crewError } = await supabase
        .from('keep_quick_link')
        .select('id, link_scope, target_type, target_id, label, subtitle, description, sort_order')
        .eq('tenant_id', currentContext.tenantId)
        .eq('link_scope', 'crew')
        .eq('area', area)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (crewError) throw crewError;

      // Fetch my links for the current BOH user in the current tenant.
      const { data: myData, error: myError } = await supabase
        .from('keep_quick_link')
        .select('id, link_scope, target_type, target_id, label, subtitle, description, sort_order')
        .eq('tenant_id', currentContext.tenantId)
        .eq('link_scope', 'user')
        .eq('user_id', currentContext.bohUserId)
        .eq('area', area)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (myError) throw myError;

      setCrewLinks((crewData || []).map(transformQuickLink));
      setMyLinks((myData || []).map(transformQuickLink));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch quick links';
      setError(message);
      console.error('[useQuickLinks] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [area, resolveBohUserContext]);

  const addMyLink = useCallback(async (link: Omit<QuickLink, 'id'>) => {
    try {
      // Resolve BOH user + tenant if not cached
      let currentBohUserId = bohUserId;
      let currentTenantId = tenantId;
      if (!currentBohUserId || !currentTenantId) {
        const currentContext = await resolveBohUserContext();
        if (!currentContext) {
          return { success: false, error: 'Failed to resolve BOH tenant context' };
        }
        currentBohUserId = currentContext.bohUserId;
        currentTenantId = currentContext.tenantId;
      }

      const { data, error } = await supabase
        .from('keep_quick_link')
        .insert({
          tenant_id: currentTenantId,
          link_scope: 'user',
          target_type: link.targetType,
          target_id: link.targetId,
          label: link.label,
          subtitle: link.subtitle,
          description: link.description,
          sort_order: link.sortOrder,
          area,
          is_active: true,
          user_id: currentBohUserId,
          created_by: currentBohUserId,
        })
        .select()
        .single();

      if (error) {
        // Check for duplicate error
        if (error.code === '23505') {
          throw new Error('You have already added this item to your links');
        }
        throw error;
      }

      setMyLinks(prev => [...prev, transformQuickLink(data)]);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add link';
      return { success: false, error: message };
    }
  }, [area, bohUserId, tenantId, resolveBohUserContext]);

  const removeMyLink = useCallback(async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('keep_quick_link')
        .delete()
        .eq('id', linkId)
        .eq('tenant_id', tenantId)
        .eq('user_id', bohUserId)
        .eq('link_scope', 'user');

      if (error) throw error;

      setMyLinks(prev => prev.filter(l => l.id !== linkId));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove link';
      return { success: false, error: message };
    }
  }, [bohUserId, tenantId]);

  // Add a crew link (admin only) - uses protected edge function
  const addCrewLink = useCallback(async (link: Omit<QuickLink, 'id'>) => {
    try {
      const { data, error } = await supabase.functions.invoke('keep-quick-link-admin', {
        method: 'POST',
        body: {
          action: 'add_crew',
          target_type: link.targetType,
          target_id: link.targetId,
          label: link.label,
          subtitle: link.subtitle,
          description: link.description,
          sort_order: link.sortOrder,
          area,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to add crew link');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to add crew link');
      }

      setCrewLinks(prev => [...prev, transformQuickLink(data.link)]);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add crew link';
      return { success: false, error: message };
    }
  }, [area]);

  // Remove a crew link (admin only) - uses protected edge function
  const removeCrewLink = useCallback(async (linkId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('keep-quick-link-admin', {
        method: 'POST',
        body: {
          action: 'remove_crew',
          link_id: linkId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to remove crew link');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to remove crew link');
      }

      setCrewLinks(prev => prev.filter(l => l.id !== linkId));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove crew link';
      return { success: false, error: message };
    }
  }, []);

  // Check if an item is in my links
  const isInMyLinks = useCallback((targetId: string) => {
    return myLinks.some(link => link.targetId === targetId);
  }, [myLinks]);

  // Check if an item is in crew links
  const isInCrewLinks = useCallback((targetId: string) => {
    return crewLinks.some(link => link.targetId === targetId);
  }, [crewLinks]);

  // Get link ID for an item in my links (for removal)
  const getMyLinkId = useCallback((targetId: string) => {
    return myLinks.find(link => link.targetId === targetId)?.id;
  }, [myLinks]);

  // Get link ID for an item in crew links (for removal)
  const getCrewLinkId = useCallback((targetId: string) => {
    return crewLinks.find(link => link.targetId === targetId)?.id;
  }, [crewLinks]);

  useEffect(() => {
    fetchQuickLinks();
  }, [fetchQuickLinks]);

  return {
    crewLinks,
    myLinks,
    loading,
    error,
    refetch: fetchQuickLinks,
    addMyLink,
    removeMyLink,
    addCrewLink,
    removeCrewLink,
    isInMyLinks,
    isInCrewLinks,
    getMyLinkId,
    getCrewLinkId,
  };
}
