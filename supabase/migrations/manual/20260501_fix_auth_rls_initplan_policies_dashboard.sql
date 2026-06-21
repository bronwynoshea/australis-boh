-- Dashboard-safe copy of 20260501_fix_auth_rls_initplan_policies.sql.
-- Run one statement at a time in the Supabase SQL editor if full-file paste fails.

-- 01
alter policy "keep_quick_link_select_user"
  on public.keep_quick_link
  using (
    link_scope = 'user'
    and is_active = true
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.user_id
        and bu.auth_user_id = (select auth.uid())
    )
  );

-- 02
alter policy "keep_quick_link_insert_user"
  on public.keep_quick_link
  with check (
    link_scope = 'user'
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.user_id
        and bu.auth_user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.created_by
        and bu.auth_user_id = (select auth.uid())
    )
  );

-- 03
alter policy "keep_quick_link_update_user"
  on public.keep_quick_link
  using (
    link_scope = 'user'
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.user_id
        and bu.auth_user_id = (select auth.uid())
    )
  )
  with check (
    link_scope = 'user'
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.user_id
        and bu.auth_user_id = (select auth.uid())
    )
  );

-- 04
alter policy "keep_quick_link_delete_user"
  on public.keep_quick_link
  using (
    link_scope = 'user'
    and exists (
      select 1
      from public.boh_user bu
      where bu.id = keep_quick_link.user_id
        and bu.auth_user_id = (select auth.uid())
    )
  );

-- 05
alter policy "keep_whiteboard_item_insert_own"
  on public.keep_whiteboard_item
  with check (
    created_by = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
    )
  );

-- 06
alter policy "keep_whiteboard_item_update_own"
  on public.keep_whiteboard_item
  using (
    created_by = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
    )
  )
  with check (
    created_by = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
    )
  );

-- 07
alter policy "keep_whiteboard_item_delete_own"
  on public.keep_whiteboard_item
  using (
    created_by = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
    )
  );

-- 08
alter policy "Only admins can manage whiteboard cards"
  on public.keep_whiteboard_card
  using (
    exists (
      select 1
      from public.boh_user
      where auth_user_id = (select auth.uid())
        and role_id in (select id from public.boh_role where key = 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.boh_user
      where auth_user_id = (select auth.uid())
        and role_id in (select id from public.boh_role where key = 'super_admin')
    )
  );

-- 09
alter policy "Users can view initiatives they own or all if super admin"
  on public.boh_initiative
  using (
    owner_user_id = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
        and app_context = 'boh'
      limit 1
    )
    or public.is_boh_super_admin()
  );

-- 10
alter policy "Users can update their own initiatives or any if super admin"
  on public.boh_initiative
  using (
    owner_user_id = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
        and app_context = 'boh'
      limit 1
    )
    or public.is_boh_super_admin()
  );

-- 11
alter policy "Users can delete their own initiatives or any if super admin"
  on public.boh_initiative
  using (
    owner_user_id = (
      select id
      from public.boh_user
      where auth_user_id = (select auth.uid())
        and app_context = 'boh'
      limit 1
    )
    or public.is_boh_super_admin()
  );

-- 12
alter policy "Forge walkthrough asset templates are readable by admins"
  on public.forge_walkthrough_asset_template
  using (
    is_active = true
    and exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = (select auth.uid())
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );

-- 13
alter policy "Forge walkthrough runs are readable by admins"
  on public.forge_walkthrough_run
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = (select auth.uid())
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );

-- 14
alter policy "Forge walkthrough artifacts are readable by admins"
  on public.forge_walkthrough_artifact
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = (select auth.uid())
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );
