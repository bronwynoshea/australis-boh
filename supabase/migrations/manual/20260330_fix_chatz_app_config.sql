-- Fix chatz app to be properly configured as external app at correct subdomain
UPDATE public.boh_app 
SET 
  route = null,
  external_url = 'https://chatz.jobzcafe.com',
  type = 'external_app',
  app_context = 'chatz',
  description = 'Staff Chat Booking System - External Subdomain',
  updated_at = now()
WHERE slug = 'chatz';

-- If chatz app doesn't exist, insert it properly as external app
INSERT INTO public.boh_app (
  id,
  name,
  slug,
  description,
  route,
  external_url,
  primary_color,
  type,
  is_active,
  app_context,
  created_at,
  location
) VALUES (
  gen_random_uuid(),
  'Chatz',
  'chatz',
  'Staff Chat Booking System - External Subdomain',
  null,
  'https://chatz.jobzcafe.com',
  '#409CFF',
  'external_app',
  true,
  'chatz',
  now(),
  'External'
) ON CONFLICT (slug) DO UPDATE SET
  route = null,
  external_url = 'https://chatz.jobzcafe.com',
  type = 'external_app',
  app_context = 'chatz',
  description = 'Staff Chat Booking System - External Subdomain',
  location = 'External',
  is_active = true,
  updated_at = now();
