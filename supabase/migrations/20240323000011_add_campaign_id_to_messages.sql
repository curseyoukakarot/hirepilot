-- Add campaign_id to messages table
ALTER TABLE messages ADD COLUMN campaign_id UUID NULL REFERENCES campaigns(id) ON DELETE SET NULL; 