UPDATE leads
SET enrichment_data = jsonb_build_object(
  'location', COALESCE(NULLIF(location, ''), 'Unknown'),
  'lead_source', 'Apollo'
); 