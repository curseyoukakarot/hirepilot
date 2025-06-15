-- Backfill campaign_location for existing leads
UPDATE leads
SET campaign_location = campaigns.location
FROM campaigns
WHERE leads.campaign_id = campaigns.id
  AND (leads.city IS NULL OR leads.city = '')
  AND (leads.state IS NULL OR leads.state = '')
  AND (leads.country IS NULL OR leads.country = ''); 