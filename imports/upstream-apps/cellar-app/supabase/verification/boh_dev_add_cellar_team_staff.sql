-- BOH-DEV only. Adds/links CELLAR staff access for these existing Supabase Auth users.
-- If this returns "missing auth user", create/invite that user in Supabase Auth first, then rerun.
do $$
declare
  staff_email text;
  staff_auth_user_id uuid;
  insert_cols text;
  insert_vals text;
begin
  if to_regclass('public.boh_user') is null then
    raise exception 'public.boh_user does not exist in this BOH-DEV project';
  end if;

  foreach staff_email in array array['alanum@jobzcafe.com', 'jloomis@jobzcafe.com']
  loop
    select au.id
      into staff_auth_user_id
    from auth.users au
    where lower(au.email) = lower(staff_email)
    limit 1;

    if staff_auth_user_id is null then
      raise notice 'missing auth user: %', staff_email;
      continue;
    end if;

    execute 'update public.boh_user set auth_user_id = $1 where lower(email) = lower($2)'
      using staff_auth_user_id, staff_email;

    if not exists (select 1 from public.boh_user where auth_user_id = staff_auth_user_id) then
      insert_cols := 'auth_user_id, email';
      insert_vals := '$1, $2';

      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boh_user' and column_name = 'name') then
        insert_cols := insert_cols || ', name';
        insert_vals := insert_vals || ', $3';
      end if;

      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boh_user' and column_name = 'display_name') then
        insert_cols := insert_cols || ', display_name';
        insert_vals := insert_vals || ', $3';
      end if;

      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boh_user' and column_name = 'role') then
        insert_cols := insert_cols || ', role';
        insert_vals := insert_vals || ', ''staff''';
      end if;

      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boh_user' and column_name = 'is_active') then
        insert_cols := insert_cols || ', is_active';
        insert_vals := insert_vals || ', true';
      end if;

      execute format('insert into public.boh_user (%s) values (%s)', insert_cols, insert_vals)
        using staff_auth_user_id, staff_email, split_part(staff_email, '@', 1);
    end if;

    raise notice 'linked staff user: %', staff_email;
  end loop;
end $$;

select id, email, auth_user_id
from public.boh_user
where lower(email) in ('alanum@jobzcafe.com', 'jloomis@jobzcafe.com')
order by email;
