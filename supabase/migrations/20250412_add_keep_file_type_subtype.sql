-- Migration: Add type and subtype columns to keep_file table
-- Created: 2025-04-12

-- Add type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'keep_file' AND column_name = 'type'
    ) THEN
        ALTER TABLE public.keep_file ADD COLUMN type VARCHAR(50);
    END IF;
END $$;

-- Add subtype column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'keep_file' AND column_name = 'subtype'
    ) THEN
        ALTER TABLE public.keep_file ADD COLUMN subtype VARCHAR(50);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.keep_file.type IS 'File classification type (e.g., document, image, video, audio, archive)';
COMMENT ON COLUMN public.keep_file.subtype IS 'File subtype classification (e.g., contract, invoice, report for documents)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_keep_file_type ON public.keep_file(type);
CREATE INDEX IF NOT EXISTS idx_keep_file_subtype ON public.keep_file(subtype);
