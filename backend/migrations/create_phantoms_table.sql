-- Create phantoms table
CREATE TABLE IF NOT EXISTS phantoms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phantom_id TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on label
ALTER TABLE phantoms ADD CONSTRAINT phantoms_label_key UNIQUE (label);

-- Add index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_phantoms_status ON phantoms(status);

-- Insert the verified phantom
INSERT INTO phantoms (phantom_id, label, status)
VALUES ('7214484821939232', 'HP Search Link (MAIN)', 'idle')
ON CONFLICT (label) DO UPDATE
SET phantom_id = EXCLUDED.phantom_id,
    status = 'idle'; 