ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT;

UPDATE leads
SET location = TRIM(CONCAT_WS(', ', NULLIF(city, ''), NULLIF(state, ''), NULLIF(country, '')))
WHERE city IS NOT NULL OR state IS NOT NULL OR country IS NOT NULL; 