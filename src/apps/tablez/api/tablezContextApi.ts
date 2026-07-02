import { supabase } from '../../../lib/supabase';
import { getCurrentBohUserContext } from '../../../boh/api/bohApi';

export type BohChair = {
  id: string;
  user_id: string | null;
  is_primary: boolean | null;
  is_active: boolean;
  table_id: string | null;
  chair_role_id: string | null;
  created_at: string | null;
  chair_role_label: string | null;
};

export type BohTable = {
  id: string;
  name: string | null;
  section_id: string | null;
};

export type BohSection = {
  id: string;
  name: string | null;
};

export type BohTableOption = BohTable & {
  section_name: string | null;
};

export type BohChairWithUser = {
  id: string;
  user_id: string | null;
  is_primary: boolean | null;
  is_active: boolean;
  table_id: string | null;
  chair_role_id: string | null;
  created_at: string | null;
  chair_role_label: string | null;
  user: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
};

type BohChairRoleRow = {
  id: string;
  label: string;
};

let chairRoleLabelMapPromise: Promise<Map<string, string>> | null = null;

async function getCurrentTenantId(): Promise<string> {
  const context = await getCurrentBohUserContext();
  if (!context?.tenant_id) {
    throw new Error('No BOH tenant matched the current session.');
  }
  return context.tenant_id;
}

async function fetchChairRoleLabelMap(): Promise<Map<string, string>> {
  if (!chairRoleLabelMapPromise) {
    chairRoleLabelMapPromise = (async () => {
      const { data, error } = await supabase
        .from('boh_chair_role')
        .select('id, label')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[tablezContextApi] fetchChairRoleLabelMap failed', {
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        return new Map<string, string>();
      }

      const map = new Map<string, string>();
      for (const r of ((data || []) as BohChairRoleRow[])) {
        map.set(r.id, r.label);
      }
      return map;
    })();
  }

  return chairRoleLabelMapPromise;
}

type BohUserLite = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

async function fetchBohUsersByIds(userIds: string[]): Promise<Map<string, BohUserLite>> {
  const tenantId = await getCurrentTenantId();
  const result = new Map<string, BohUserLite>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return result;

  const { data, error } = await supabase
    .from('boh_user')
    .select('id, display_name, full_name, email')
    .eq('tenant_id', tenantId)
    .eq('app_context', 'boh')
    .in('id', uniqueIds);

  if (error) {
    console.warn('[tablezContextApi] fetchBohUsersByIds failed', {
      count: uniqueIds.length,
      error,
    });
    return result;
  }

  for (const u of (data || []) as BohUserLite[]) {
    result.set(u.id, u);
  }

  return result;
}

export async function fetchActiveChairsForUser(userId: string): Promise<BohChair[]> {
  const tenantId = await getCurrentTenantId();
  console.debug('[tablezContextApi] fetchActiveChairsForUser', {
    table: 'boh_chair',
    filters: { user_id: userId, is_active: true },
  });
  async function queryByBohUserId(bohUserId: string) {
    return await supabase
      .from('boh_chair')
      .select('id, table_id, user_id, is_primary, is_active, created_at, chair_role_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', bohUserId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
  }

  let { data, error } = await queryByBohUserId(userId);

  if (error) {
    console.error('[tablezContextApi] Error fetching chairs for user', {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    throw error;
  }

  if ((data || []).length === 0) {
    const { data: bohUserRow, error: bohUserErr } = await supabase
      .from('boh_user')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (bohUserErr) {
      console.warn('[tablezContextApi] fetchActiveChairsForUser: failed to resolve boh_user via auth_user_id', {
        auth_user_id: userId,
        error: bohUserErr,
      });
    } else if (bohUserRow?.id) {
      console.warn('[tablezContextApi] fetchActiveChairsForUser: userId looked like auth_user_id, retrying with boh_user.id', {
        auth_user_id: userId,
        boh_user_id: bohUserRow.id,
      });
      const retry = await queryByBohUserId(bohUserRow.id);
      data = retry.data;
      error = retry.error;

      if (error) {
        console.error('[tablezContextApi] Error fetching chairs for resolved boh_user', {
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        throw error;
      }
    }
  }

  console.debug('[tablezContextApi] fetchActiveChairsForUser result', {
    count: (data || []).length,
  });

  const roleLabelMap = await fetchChairRoleLabelMap();
  return ((data || []) as unknown as Array<Omit<BohChair, 'chair_role_label'> & { chair_role_label?: never }>).map((c) => {
    const chairRoleLabel = c.chair_role_id ? (roleLabelMap.get(c.chair_role_id) ?? null) : null;
    return {
      ...(c as unknown as Omit<BohChair, 'chair_role_label'>),
      chair_role_label: chairRoleLabel,
    };
  });
}

export async function fetchTableForChairTableId(tableId: string): Promise<BohTable | null> {
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from('boh_table')
    .select('id, name')
    .eq('id', tableId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching table:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...(data as Pick<BohTable, 'id' | 'name'>),
    section_id: null,
  };
}

export async function fetchActiveTables(): Promise<BohTableOption[]> {
  const tenantId = await getCurrentTenantId();
  console.debug('[tablezContextApi] fetchActiveTables', {
    table: 'boh_table',
    filters: { is_active: true },
    note: "Intentionally not filtering by app_context to avoid prod mismatches",
  });
  const { data: tables, error: tablesErr } = await supabase
    .from('boh_table')
    .select('id, name, section_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (tablesErr) {
    console.error('Error fetching tables:', tablesErr);
    throw tablesErr;
  }

  console.debug('[tablezContextApi] fetchActiveTables result', {
    count: (tables || []).length,
  });

  const tableRows = (tables || []) as BohTable[];
  const sectionIds = Array.from(new Set(tableRows.map(t => t.section_id).filter(Boolean))) as string[];

  let sectionNameById = new Map<string, string | null>();
  if (sectionIds.length > 0) {
    const { data: sections, error: sectionsErr } = await supabase
      .from('boh_section')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .in('id', sectionIds);

    if (sectionsErr) {
      console.error('Error fetching sections:', sectionsErr);
      // Non-fatal: table list can still render without section names
    } else {
      for (const s of (sections || []) as BohSection[]) {
        sectionNameById.set(s.id, s.name);
      }
    }
  }

  return tableRows.map((t) => ({
    ...t,
    section_name: t.section_id ? (sectionNameById.get(t.section_id) ?? null) : null,
  }));
}

export async function fetchChairsForTable(tableId: string): Promise<BohChairWithUser[]> {
  const tenantId = await getCurrentTenantId();
  console.debug('[tablezContextApi] fetchChairsForTable', {
    table: 'boh_chair',
    filters: { table_id: tableId, is_active: true },
  });
  const { data, error } = await supabase
    .from('boh_chair')
    .select('id, table_id, user_id, is_primary, is_active, created_at, chair_role_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('table_id', tableId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[tablezContextApi] Error fetching chairs for table', {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    throw error;
  }

  console.debug('[tablezContextApi] fetchChairsForTable result', {
    count: (data || []).length,
  });

  const chairRows = (data || []) as unknown as Array<Omit<BohChairWithUser, 'user' | 'chair_role_label'> & { user: never; chair_role_label?: never }>;
  const userIds = chairRows.map((c) => c.user_id).filter(Boolean) as string[];
  const usersById = await fetchBohUsersByIds(userIds);
  const roleLabelMap = await fetchChairRoleLabelMap();

  return chairRows.map((c) => {
    const user = c.user_id ? (usersById.get(c.user_id) ?? null) : null;
    const chairRoleLabel = c.chair_role_id ? (roleLabelMap.get(c.chair_role_id) ?? null) : null;
    return {
      ...(c as unknown as Omit<BohChairWithUser, 'user' | 'chair_role_label'>),
      user,
      chair_role_label: chairRoleLabel,
    };
  });
}
