do $$
begin
  if to_regclass('public.forge_walkthrough_recipe') is not null
     and to_regclass('public.forge_walkthrough_asset_template') is null then
    alter table public.forge_walkthrough_recipe
      rename to forge_walkthrough_asset_template;
  end if;
end $$;

do $$
begin
  if to_regclass('public.forge_walkthrough_run') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'forge_walkthrough_run'
         and column_name = 'recipe_id'
     )
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'forge_walkthrough_run'
         and column_name = 'asset_template_id'
     ) then
    alter table public.forge_walkthrough_run
      rename column recipe_id to asset_template_id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.forge_walkthrough_asset_template') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'forge_walkthrough_asset_template'
         and column_name = 'recipe_path'
     )
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'forge_walkthrough_asset_template'
         and column_name = 'asset_template_path'
     ) then
    alter table public.forge_walkthrough_asset_template
      rename column recipe_path to asset_template_path;
  end if;
end $$;

alter index if exists public.idx_forge_walkthrough_run_recipe_id
  rename to idx_forge_walkthrough_run_asset_template_id;

drop policy if exists "Forge walkthrough recipes are readable by authenticated users" on public.forge_walkthrough_asset_template;
drop policy if exists "Forge walkthrough recipes are readable by admins" on public.forge_walkthrough_asset_template;
drop policy if exists "Forge walkthrough asset templates are readable by admins" on public.forge_walkthrough_asset_template;

create policy "Forge walkthrough asset templates are readable by admins"
  on public.forge_walkthrough_asset_template
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = auth.uid()
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

update public.forge_walkthrough_asset_template
set asset_template_path = replace(asset_template_path, '/recipes/', '/asset-templates/'),
    updated_at = now()
where asset_template_path like '%/recipes/%';
