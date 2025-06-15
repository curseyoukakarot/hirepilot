-- Create materialized view for daily email stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_email_stats AS
SELECT
    date_trunc('day', event_timestamp) as day,
    user_id,
    provider,
    COUNT(*) FILTER (WHERE event_type = 'sent') as sent,
    COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE event_type = 'open') as opens,
    COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'reply') as replies,
    COUNT(*) FILTER (WHERE event_type = 'bounce') as bounces
FROM email_events
GROUP BY 1, 2, 3;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_email_stats ON daily_email_stats(day, user_id, provider); 