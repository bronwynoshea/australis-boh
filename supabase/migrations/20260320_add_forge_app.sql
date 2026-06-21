-- Add missing Forge app to database
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
  created_at
) VALUES (
  gen_random_uuid(),
  'Forge',
  'forge',
  'Delivery & Execution',
  '/forge',
  null,
  null,
  'internal_tool',
  true,
  'boh',
  now()
);
