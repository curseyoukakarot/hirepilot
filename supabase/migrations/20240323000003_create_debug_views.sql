-- Create a debug view for email events
CREATE OR REPLACE VIEW vw_email_events_debug AS
SELECT
    e.id,
    e.user_id,
    e.campaign_id,
    e.lead_id,
    e.provider,
    e.message_id,
    e.event_type,
    e.event_timestamp,
    c.title as campaign_title,
    l.email as lead_email
FROM email_events e
LEFT JOIN campaigns c ON c.id = e.campaign_id
LEFT JOIN leads l ON l.id = e.lead_id
ORDER BY e.event_timestamp DESC;

-- Create a debug view for campaign metrics
CREATE OR REPLACE VIEW vw_campaign_metrics_debug AS
SELECT
    c.id as campaign_id,
    c.title as campaign_title,
    c.user_id,
    COUNT(DISTINCT CASE WHEN e.event_type = 'sent' THEN e.message_id END) as sent_count,
    COUNT(DISTINCT CASE WHEN e.event_type = 'open' THEN e.message_id END) as open_count,
    COUNT(DISTINCT CASE WHEN e.event_type = 'reply' THEN e.lead_id END) as reply_count
FROM campaigns c
LEFT JOIN email_events e ON e.campaign_id = c.id
GROUP BY c.id, c.title, c.user_id; 