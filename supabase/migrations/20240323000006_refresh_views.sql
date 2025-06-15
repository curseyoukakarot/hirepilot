-- Refresh materialized views
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'daily_email_stats') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY daily_email_stats;
    END IF;
END $$; 