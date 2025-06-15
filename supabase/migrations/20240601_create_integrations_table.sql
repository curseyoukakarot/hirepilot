-- Create integrations table for tracking user integration status
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'not_connected',
  connected_at timestamptz,
  metadata jsonb
);

-- Unique constraint: one row per user per provider
CREATE UNIQUE INDEX idx_integrations_user_provider ON integrations(user_id, provider); 