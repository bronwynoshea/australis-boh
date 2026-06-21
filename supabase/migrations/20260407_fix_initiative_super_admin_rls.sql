-- Fix RLS policies to allow super admins to bypass ownership checks on boh_initiative
-- This allows super admins to edit ANY initiative regardless of owner_user_id

-- First, drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Users can update their own initiatives" ON public.boh_initiative;
DROP POLICY IF EXISTS "Users can delete their own initiatives" ON public.boh_initiative;

-- Create a helper function to check if current user is super admin
-- This checks the boh_user_role table for super_admin role assignment
CREATE OR REPLACE FUNCTION public.is_boh_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.boh_user_role bur
    JOIN public.boh_role br ON br.id = bur.role_id
    JOIN public.boh_user bu ON bu.id = bur.user_id
    WHERE bu.auth_user_id = auth.uid()
      AND br.code = 'super_admin'
      AND bu.app_context = 'boh'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Allow users to view initiatives they own OR if they're super admin
CREATE POLICY "Users can view initiatives they own or all if super admin"
  ON public.boh_initiative
  FOR SELECT
  TO authenticated
  USING (
    owner_user_id = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid() AND app_context = 'boh' LIMIT 1)
    OR public.is_boh_super_admin()
  );

-- Policy: Allow users to insert initiatives (any authenticated user can create)
CREATE POLICY "Users can insert initiatives"
  ON public.boh_initiative
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow users to update their own initiatives OR if they're super admin
CREATE POLICY "Users can update their own initiatives or any if super admin"
  ON public.boh_initiative
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid() AND app_context = 'boh' LIMIT 1)
    OR public.is_boh_super_admin()
  );

-- Policy: Allow users to delete their own initiatives OR if they're super admin
CREATE POLICY "Users can delete their own initiatives or any if super admin"
  ON public.boh_initiative
  FOR DELETE
  TO authenticated
  USING (
    owner_user_id = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid() AND app_context = 'boh' LIMIT 1)
    OR public.is_boh_super_admin()
  );

-- Ensure RLS is enabled on the table
ALTER TABLE public.boh_initiative ENABLE ROW LEVEL SECURITY;
