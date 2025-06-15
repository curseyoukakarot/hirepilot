UPDATE leads
SET enrichment_data = jsonb_build_object(
  'first_name', first_name,
  'last_name', last_name,
  'location', COALESCE(NULLIF(location, ''), 'Unknown'),
  'lead_source', 'Apollo'
)
WHERE enrichment_data IS NULL OR enrichment_data = '{}'::jsonb; 