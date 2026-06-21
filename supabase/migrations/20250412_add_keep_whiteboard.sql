-- Migration: Create keep_whiteboard_item table for idea capture
-- Created: 2025-04-12

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS public.keep_whiteboard_item;

-- Create whiteboard items table
CREATE TABLE IF NOT EXISTS public.keep_whiteboard_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.keep_whiteboard_card(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.boh_user(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure title is not empty
    CONSTRAINT keep_whiteboard_item_title_not_empty CHECK (title <> '')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_item_card_id
    ON public.keep_whiteboard_item(card_id);

CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_item_created_by
    ON public.keep_whiteboard_item(created_by);

CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_item_created_at
    ON public.keep_whiteboard_item(created_at DESC);

-- Enable RLS
ALTER TABLE public.keep_whiteboard_item ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "keep_whiteboard_item_select_own" ON public.keep_whiteboard_item;
DROP POLICY IF EXISTS "keep_whiteboard_item_insert_own" ON public.keep_whiteboard_item;
DROP POLICY IF EXISTS "keep_whiteboard_item_update_own" ON public.keep_whiteboard_item;
DROP POLICY IF EXISTS "keep_whiteboard_item_delete_own" ON public.keep_whiteboard_item;

-- RLS Policy: All authenticated users can view all whiteboard items (shared visibility)
CREATE POLICY "keep_whiteboard_item_select_all"
ON public.keep_whiteboard_item
FOR SELECT
TO authenticated
USING (true);

-- RLS Policy: Users can insert their own whiteboard items
CREATE POLICY "keep_whiteboard_item_insert_own"
ON public.keep_whiteboard_item
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid())
);

-- RLS Policy: Users can update only their own whiteboard items
CREATE POLICY "keep_whiteboard_item_update_own"
ON public.keep_whiteboard_item
FOR UPDATE
TO authenticated
USING (
    created_by = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid())
)
WITH CHECK (
    created_by = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid())
);

-- RLS Policy: Users can delete only their own whiteboard items
CREATE POLICY "keep_whiteboard_item_delete_own"
ON public.keep_whiteboard_item
FOR DELETE
TO authenticated
USING (
    created_by = (SELECT id FROM public.boh_user WHERE auth_user_id = auth.uid())
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_keep_whiteboard_item_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_whiteboard_item_updated_at ON public.keep_whiteboard_item;

CREATE TRIGGER trg_keep_whiteboard_item_updated_at
    BEFORE UPDATE ON public.keep_whiteboard_item
    FOR EACH ROW
    EXECUTE FUNCTION public.update_keep_whiteboard_item_updated_at();

-- Comment
COMMENT ON TABLE public.keep_whiteboard_item IS
'Lightweight idea capture whiteboard items for Keep. Each item is owned by the user who created it.';
