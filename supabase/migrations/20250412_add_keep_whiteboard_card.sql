-- Migration: Create keep_whiteboard_card lookup table for configurable whiteboard cards
-- Created: 2025-04-12

-- Create whiteboard card types table
CREATE TABLE IF NOT EXISTS public.keep_whiteboard_card (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    color_token TEXT,
    icon_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on key for lookups
CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_card_key
    ON public.keep_whiteboard_card(key);

CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_card_sort_order
    ON public.keep_whiteboard_card(sort_order);

CREATE INDEX IF NOT EXISTS idx_keep_whiteboard_card_is_active
    ON public.keep_whiteboard_card(is_active);

-- Enable RLS
ALTER TABLE public.keep_whiteboard_card ENABLE ROW LEVEL SECURITY;

-- Everyone can read active cards
CREATE POLICY "Anyone can view active whiteboard cards"
    ON public.keep_whiteboard_card
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only super admins can manage cards (using boh_user check)
CREATE POLICY "Only admins can manage whiteboard cards"
    ON public.keep_whiteboard_card
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.boh_user
            WHERE auth_user_id = auth.uid()
            AND role_id IN (SELECT id FROM public.boh_role WHERE key = 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.boh_user
            WHERE auth_user_id = auth.uid()
            AND role_id IN (SELECT id FROM public.boh_role WHERE key = 'super_admin')
        )
    );

-- Seed default cards
-- color_token uses BOH design system variants: primary-accent, success-accent, neutral-accent, surface-accent
INSERT INTO public.keep_whiteboard_card (key, label, description, sort_order, color_token, icon_key)
VALUES
    ('idea', 'New Ideas', 'Quick ideas and inspirations', 30, 'surface-accent', 'lightbulb'),
    ('topic', 'Research Topics', 'Discussion topics and themes', 40, 'success-accent', 'chat'),
    ('agenda', 'Agenda Items', 'Meeting agenda items', 10, 'primary-accent', 'calendar'),
    ('question', 'Questions', 'Open questions to explore', 20, 'neutral-accent', 'help')
ON CONFLICT (key) DO UPDATE SET color_token = EXCLUDED.color_token;

-- Add updated_at trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_keep_whiteboard_card_updated_at'
    ) THEN
        CREATE TRIGGER set_keep_whiteboard_card_updated_at
            BEFORE UPDATE ON public.keep_whiteboard_card
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END
$$;
