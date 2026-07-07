import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

type BohUserRow = {
  id: string;
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
};

type BohChairRow = {
  id: string;
  chair_role_label: string | null;
  is_primary: boolean | null;
  is_active: boolean;
  table_id: string | null;
  user_id: string | null;
  created_at: string | null;
  chair_role_id: string | null;
};

type BohChairRoleRow = {
  id: string;
  label: string;
};

type BohTableRow = {
  id: string;
  name: string | null;
  section_id?: string | null;
};

type BohSectionRow = {
  id: string;
  name: string | null;
};

const BohSettingsProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [authUser, setAuthUser] = useState<{ id: string; email: string | null } | null>(null);
  const [bohUser, setBohUser] = useState<BohUserRow | null>(null);
  const [chairs, setChairs] = useState<BohChairRow[]>([]);
  const [primaryChair, setPrimaryChair] = useState<BohChairRow | null>(null);
  const [table, setTable] = useState<BohTableRow | null>(null);
  const [section, setSection] = useState<BohSectionRow | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chairNotice, setChairNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setChairNotice(null);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) {
          throw new Error(authErr.message || 'Failed to load auth user');
        }

        if (!authData?.user) {
          if (!mounted) return;
          setAuthUser(null);
          setBohUser(null);
          setChairs([]);
          setPrimaryChair(null);
          setTable(null);
          setSection(null);
          setChairNotice(null);
          setIsLoading(false);
          return;
        }

        const auth = { id: authData.user.id, email: authData.user.email ?? null };
        if (!mounted) return;
        setAuthUser(auth);

        const { data: bohUserData, error: bohUserErr } = await supabase
          .from('boh_user')
          .select('id, auth_user_id, first_name, last_name, email, status')
          .eq('auth_user_id', auth.id)
          .eq('app_context', 'boh')
          .maybeSingle();

        if (bohUserErr) {
          throw new Error(bohUserErr.message || 'Failed to load BOH user profile');
        }

        if (!mounted) return;
        setBohUser((bohUserData || null) as BohUserRow | null);

        if (!bohUserData?.id) {
          setChairs([]);
          setPrimaryChair(null);
          setTable(null);
          setSection(null);
          setChairNotice(null);
          setIsLoading(false);
          return;
        }

        const { data: chairsData, error: chairsErr } = await supabase
          .from('boh_chair')
          .select('id, table_id, user_id, is_primary, is_active, created_at, chair_role_id')
          .eq('user_id', bohUserData.id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: true });

        if (chairsErr) {
          console.error('[BOH Settings] Error loading chairs', {
            code: (chairsErr as any).code,
            message: chairsErr.message,
            details: (chairsErr as any).details,
            hint: (chairsErr as any).hint,
          });

          const missingChairTable =
            (chairsErr as any).code === 'PGRST205' ||
            chairsErr.message?.includes('boh_chair') ||
            chairsErr.message?.includes('schema cache');

          if (missingChairTable) {
            if (!mounted) return;
            setChairs([]);
            setPrimaryChair(null);
            setTable(null);
            setSection(null);
            setChairNotice('Chair assignment data is not available in this environment yet.');
            setIsLoading(false);
            return;
          }

          throw new Error(chairsErr.message || 'Failed to load chairs');
        }

        const { data: roleData, error: roleErr } = await supabase
          .from('boh_chair_role')
          .select('id, label')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (roleErr) {
          console.error('[BOH Settings] Error loading chair roles', {
            code: (roleErr as any).code,
            message: roleErr.message,
            details: (roleErr as any).details,
            hint: (roleErr as any).hint,
          });
          setChairNotice('Chair role labels are not available in this environment yet.');
        }

        const roleLabelById = new Map<string, string>();
        for (const r of ((roleData || []) as BohChairRoleRow[])) {
          roleLabelById.set(r.id, r.label);
        }

        const chairsList = ((chairsData || []) as Array<Omit<BohChairRow, 'chair_role_label'> & { chair_role_label?: never }>).map((c) => {
          const chairRoleLabel = c.chair_role_id ? (roleLabelById.get(c.chair_role_id) ?? null) : null;
          return {
            ...(c as unknown as Omit<BohChairRow, 'chair_role_label'>),
            chair_role_label: chairRoleLabel,
          };
        });
        if (!mounted) return;
        setChairs(chairsList);

        const selectedChair = chairsList[0] || null;
        setPrimaryChair(selectedChair);

        if (!selectedChair?.table_id) {
          setTable(null);
          setSection(null);
          setIsLoading(false);
          return;
        }

        const { data: tableData, error: tableErr } = await supabase
          .from('boh_table')
          .select('id, name')
          .eq('id', selectedChair.table_id)
          .maybeSingle();

        if (tableErr) {
          throw new Error(tableErr.message || 'Failed to load table');
        }

        if (!mounted) return;
        setTable((tableData ? ({ ...tableData, section_id: null } as BohTableRow) : null) as BohTableRow | null);
        setSection(null);
        setIsLoading(false);
      } catch (err) {
        console.error('[BOH Settings] Error loading profile diagnostics:', err);
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="space-y-1 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
            Settings
          </h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            Profile diagnostics for Australis Back of House.
          </p>
        </header>

        {isLoading && (
          <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading profile...</div>
        )}

        {!isLoading && error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!isLoading && !error && !authUser && (
          <div className="space-y-3">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">Not logged in.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/boh/login')}
              className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium"
            >
              Go to login
            </button>
          </div>
        )}

        {!isLoading && !error && authUser && (
          <div className="space-y-6">
            <section className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-1">Auth</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Email</div>
                  <div className="text-boh-text-light dark:text-boh-text break-all">{authUser.email || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">auth_user_id</div>
                  <div className="text-boh-text-light dark:text-boh-text break-all">{authUser.id}</div>
                </div>
              </div>
            </section>

            <section className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-1">BOH User</h2>

              {!bohUser && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                  No BOH user profile found for this login.
                </div>
              )}

              {bohUser && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">boh_user.id</div>
                    <div className="text-boh-text-light dark:text-boh-text break-all">{bohUser.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">status</div>
                    <div className="text-boh-text-light dark:text-boh-text">{bohUser.status || 'Not set'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">first_name + last_name</div>
                    <div className="text-boh-text-light dark:text-boh-text">{[bohUser.first_name, bohUser.last_name].filter(Boolean).join(' ').trim() || 'Incomplete profile'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">auth_user_id</div>
                    <div className="text-boh-text-light dark:text-boh-text break-all">{bohUser.auth_user_id}</div>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-1">Chair Assignment</h2>

              {chairNotice && (
                <div className="mt-3 p-3 bg-boh-bg-light dark:bg-boh-bg border border-boh-border-light dark:border-boh-border rounded text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {chairNotice}
                </div>
              )}

              {bohUser && !chairNotice && chairs.length === 0 && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                  No chair assigned to this BOH user.
                </div>
              )}

              {bohUser && primaryChair && (
                <div className="mt-3 space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">primary chair</div>
                      <div className="text-boh-text-light dark:text-boh-text">{primaryChair.chair_role_label || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">chair_id</div>
                      <div className="text-boh-text-light dark:text-boh-text break-all">{primaryChair.id}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">table</div>
                      <div className="text-boh-text-light dark:text-boh-text">{table?.name || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">table_id</div>
                      <div className="text-boh-text-light dark:text-boh-text break-all">{table?.id || primaryChair.table_id || 'Not set'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">section</div>
                      <div className="text-boh-text-light dark:text-boh-text">{section?.name || 'Not set'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">section_id</div>
                      <div className="text-boh-text-light dark:text-boh-text break-all">{section?.id || table?.section_id || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default BohSettingsProfilePage;
