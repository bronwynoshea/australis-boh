-- Migration: Create keep_quick_link table for Crew Links and My Links
-- Created: 2025-04-12
-- Corrected: Respects boh_user.auth_user_id mapping (NOT boh_user.id = auth.uid())

-- Drop old table if exists (to replace with corrected schema)
DROP TABLE IF EXISTS public.keep_quick_link;

-- Quick links table with proper boh_user mapping
CREATE TABLE IF NOT EXISTS public.keep_quick_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    link_scope TEXT NOT NULL CHECK (link_scope IN ('crew', 'user')),
    target_type TEXT NOT NULL CHECK (target_type IN ('file', 'folder')),
    target_id UUID NOT NULL,

    user_id UUID REFERENCES public.boh_user(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.boh_user(id),

    label TEXT,
    subtitle TEXT,
    description TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,

    area TEXT NOT NULL DEFAULT 'workspace'
        CHECK (area IN ('workspace', 'gold_library')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraint: crew links have no user_id, user links must have user_id
    CONSTRAINT keep_quick_link_scope_user_check
    CHECK (
        (link_scope = 'crew' AND user_id IS NULL)
        OR
        (link_scope = 'user' AND user_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keep_quick_link_scope
    ON public.keep_quick_link(link_scope, area, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_keep_quick_link_user
    ON public.keep_quick_link(user_id, area, is_active)
    WHERE link_scope = 'user';

CREATE INDEX IF NOT EXISTS idx_keep_quick_link_target
    ON public.keep_quick_link(target_type, target_id);

-- Unique indexes for duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_keep_quick_link_user_unique
    ON public.keep_quick_link(user_id, target_type, target_id, area)
    WHERE link_scope = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS idx_keep_quick_link_crew_unique
    ON public.keep_quick_link(target_type, target_id, area)
    WHERE link_scope = 'crew';

-- Enable RLS
ALTER TABLE public.keep_quick_link ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Crew links readable by all authenticated users
CREATE POLICY "keep_quick_link_select_crew"
ON public.keep_quick_link
FOR SELECT
TO authenticated
USING (
    link_scope = 'crew'
    AND is_active = true
);

-- RLS Policy: User links readable only by owner (via boh_user.auth_user_id)
CREATE POLICY "keep_quick_link_select_user"
ON public.keep_quick_link
FOR SELECT
TO authenticated
USING (
    link_scope = 'user'
    AND is_active = true
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.user_id
          AND bu.auth_user_id = auth.uid()
    )
);

-- RLS Policy: User links insertable only by owner (via boh_user.auth_user_id)
CREATE POLICY "keep_quick_link_insert_user"
ON public.keep_quick_link
FOR INSERT
TO authenticated
WITH CHECK (
    link_scope = 'user'
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.user_id
          AND bu.auth_user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.created_by
          AND bu.auth_user_id = auth.uid()
    )
);

-- RLS Policy: User links updatable only by owner
CREATE POLICY "keep_quick_link_update_user"
ON public.keep_quick_link
FOR UPDATE
TO authenticated
USING (
    link_scope = 'user'
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.user_id
          AND bu.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    link_scope = 'user'
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.user_id
          AND bu.auth_user_id = auth.uid()
    )
);

-- RLS Policy: User links deletable only by owner
CREATE POLICY "keep_quick_link_delete_user"
ON public.keep_quick_link
FOR DELETE
TO authenticated
USING (
    link_scope = 'user'
    AND EXISTS (
        SELECT 1
        FROM public.boh_user bu
        WHERE bu.id = keep_quick_link.user_id
          AND bu.auth_user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_keep_quick_link_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_quick_link_updated_at ON public.keep_quick_link;

CREATE TRIGGER trg_keep_quick_link_updated_at
    BEFORE UPDATE ON public.keep_quick_link
    FOR EACH ROW
    EXECUTE FUNCTION public.update_keep_quick_link_updated_at();

-- Comment
COMMENT ON TABLE public.keep_quick_link IS
'Quick links for Keep, supporting crew-level shared shortcuts and user-level personal shortcuts. Uses boh_user.id (not auth.uid()) for user references.';
