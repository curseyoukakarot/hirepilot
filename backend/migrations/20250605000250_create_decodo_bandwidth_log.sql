CREATE TABLE IF NOT EXISTS decodo_bandwidth_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  bytes INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE VIEW IF NOT EXISTS decodo_bandwidth_rollup AS
SELECT date_trunc('hour', created_at) AS hour,
       SUM(bytes) AS total_bytes
FROM decodo_bandwidth_log
GROUP BY 1; 