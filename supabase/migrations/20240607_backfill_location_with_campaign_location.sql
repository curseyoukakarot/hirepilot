UPDATE leads
SET location = COALESCE(
  TRIM(CONCAT_WS(', ', NULLIF(city, ''), NULLIF(state, ''), NULLIF(country, ''))),
  campaign_location,
  'Unknown'
)
WHERE location IS NULL OR location = ''; 