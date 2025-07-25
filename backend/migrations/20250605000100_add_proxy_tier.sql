ALTER TABLE proxy_pool ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'local';

-- Backfill existing rows
UPDATE proxy_pool SET tier = 'local' WHERE tier IS NULL;

-- Insert Decodo primary proxy (idempotent)
INSERT INTO proxy_pool (
  provider,
  endpoint,
  username,
  password,
  tier,
  max_concurrent_users,
  rotation_interval_minutes,
  status,
  global_success_count,
  global_failure_count,
  created_at,
  updated_at
)
SELECT
  'custom',
  'unblock.decodo.com:60000',
  current_setting('DECODO_USER', true),
  current_setting('DECODO_PASS', true),
  'decodo',
  100,
  60,
  'active',
  0,
  0,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM proxy_pool WHERE endpoint = 'unblock.decodo.com:60000'
); 