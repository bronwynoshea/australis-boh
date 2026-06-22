-- CELLAR BOH-DEV additive helpers. Do not run against production BOH without approval.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.cellar_current_boh_user_id()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cellar_boh_user_id text;
begin
  if auth.uid() is null or to_regclass('public.boh_user') is null then
    return null;
  end if;

  execute 'select id::text from public.boh_user where auth_user_id = $1 limit 1'
    into cellar_boh_user_id
    using auth.uid();
  return cellar_boh_user_id;
end;
$$;

comment on function public.cellar_current_boh_user_id() is
  'CELLAR helper: resolves Supabase auth.uid() to public.boh_user.id for staff audit and RLS. Returns null if BOH-DEV public.boh_user is unavailable.';

create or replace function public.cellar_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.cellar_touch_updated_at() is
  'CELLAR helper trigger for additive MVP tables.';

create or replace function public.cellar_normalize_access_code(raw_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(raw_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.cellar_sha256_hex(raw_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(convert_to(coalesce(raw_value, ''), 'UTF8'), 'sha256'), 'hex')
$$;
