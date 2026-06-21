-- Ensure BOH user avatar/profile sync preserves tenant ownership for Slotz staff profiles.
-- The scheduling/Slotz tables are tenant-scoped; this trigger runs from boh_user
-- and must carry NEW.tenant_id into scheduling_staff_profiles.

CREATE OR REPLACE FUNCTION public.sync_boh_avatar_to_staff_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  INSERT INTO public.scheduling_staff_profiles (
    user_id,
    tenant_id,
    avatar_url,
    full_name,
    email,
    slug,
    app_context,
    timezone
  )
  VALUES (
    NEW.auth_user_id,
    NEW.tenant_id,
    NEW.avatar_url,
    NEW.full_name,
    NEW.email,
    lower(replace(NEW.full_name, ' ', '-')) || '-' || substr(NEW.auth_user_id::text, 1, 8),
    'cafe',
    'America/New_York'
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    avatar_url = EXCLUDED.avatar_url,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$function$;
