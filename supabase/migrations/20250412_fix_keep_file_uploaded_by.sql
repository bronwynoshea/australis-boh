-- Migration: Fix keep_file.uploaded_by to use boh_user.id instead of auth_user_id
-- Created: 2025-04-12

-- Update existing files where uploaded_by contains auth_user_id
-- by looking up the matching boh_user record
UPDATE public.keep_file kf
SET uploaded_by = bu.id
FROM public.boh_user bu
WHERE kf.uploaded_by = bu.auth_user_id
  AND bu.app_context = 'boh';

-- Log how many records were updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM public.keep_file kf
    JOIN public.boh_user bu ON kf.uploaded_by = bu.id
    WHERE kf.updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Updated % keep_file records to use boh_user.id', updated_count;
END $$;

-- Add comment explaining the field
COMMENT ON COLUMN public.keep_file.uploaded_by IS 'References boh_user.id (not auth_user_id)';
