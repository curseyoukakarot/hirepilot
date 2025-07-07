-- Add scheduled_at column to messages for delayed sending
alter table messages
  add column if not exists scheduled_at timestamptz;

-- Ensure status column exists and is text/varchar (assumed)
-- Create composite index for scheduler lookup
create index if not exists idx_messages_scheduled
  on messages(status, scheduled_at); 