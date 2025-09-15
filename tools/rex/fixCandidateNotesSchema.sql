-- Fix candidate_notes table to ensure it has the required columns
-- This script adds missing columns if they don't exist

-- Add author_name column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'candidate_notes' AND column_name = 'author_name') THEN
        ALTER TABLE candidate_notes ADD COLUMN author_name text;
    END IF;
END $$;

-- Add note_text column if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'candidate_notes' AND column_name = 'note_text') THEN
        ALTER TABLE candidate_notes ADD COLUMN note_text text;
    END IF;
END $$;

-- Add author_avatar_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'candidate_notes' AND column_name = 'author_avatar_url') THEN
        ALTER TABLE candidate_notes ADD COLUMN author_avatar_url text;
    END IF;
END $$;

-- Update existing records to have author_name if it's null
UPDATE candidate_notes 
SET author_name = 'REX Assistant' 
WHERE author_name IS NULL;

-- Update existing records to have note_text if it's null
UPDATE candidate_notes 
SET note_text = 'Note added via REX' 
WHERE note_text IS NULL;

-- Show the current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidate_notes' 
ORDER BY ordinal_position;
