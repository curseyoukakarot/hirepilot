-- Backfill UI-friendly fields for existing messages
-- This fixes messages that were sent before the UI fields were properly populated

BEGIN;

-- Update messages that have null UI fields
UPDATE messages 
SET 
  -- Set sender info
  sender = 'You',
  avatar = 'https://ui-avatars.com/api/?name=' || 
           CASE 
             WHEN from_address IS NOT NULL THEN encode(from_address::bytea, 'base64')
             ELSE 'You'
           END || '&background=random',
  
  -- Set recipient if null (use to_email)
  recipient = COALESCE(recipient, to_email),
  
  -- Set from_address if null (try to extract from user email or use default)
  from_address = COALESCE(
    from_address,
    CASE 
      WHEN provider = 'sendgrid' THEN 'you@example.com'
      WHEN provider = 'gmail' OR provider = 'google' THEN 'you@gmail.com' 
      WHEN provider = 'outlook' THEN 'you@outlook.com'
      ELSE 'you@example.com'
    END
  ),
  
  -- Create preview from content (strip HTML tags, limit to 100 chars)
  preview = LEFT(
    TRIM(
      REGEXP_REPLACE(
        COALESCE(content, subject, ''), 
        '<[^>]*>', 
        '', 
        'g'
      )
    ), 
    100
  ),
  
  -- Convert sent_at to readable time format
  time = CASE 
    WHEN sent_at IS NOT NULL THEN 
      TO_CHAR(sent_at AT TIME ZONE 'UTC', 'HH12:MI:SS AM')
    ELSE 
      TO_CHAR(created_at AT TIME ZONE 'UTC', 'HH12:MI:SS AM')
  END,
  
  -- Set read/unread status (mark sent messages as read)
  read = CASE 
    WHEN status = 'sent' THEN true
    WHEN status = 'draft' THEN false
    ELSE COALESCE(read, false)
  END,
  
  unread = CASE 
    WHEN status = 'sent' THEN false
    WHEN status = 'draft' THEN true
    ELSE COALESCE(unread, true)
  END,
  
  -- Update the updated_at timestamp
  updated_at = NOW()

WHERE 
  -- Only update messages that need updating (have null UI fields)
  (sender IS NULL OR avatar IS NULL OR preview IS NULL OR time IS NULL)
  AND status IN ('sent', 'draft', 'trash');

-- Log the number of updated records
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled UI fields for % messages', updated_count;
END $$;

COMMIT; 