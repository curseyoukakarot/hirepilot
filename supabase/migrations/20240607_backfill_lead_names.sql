-- Backfill first_name and last_name for leads
UPDATE leads
SET first_name = COALESCE(first_name, firstName, ''),
    last_name = COALESCE(last_name, lastName, '')
WHERE (first_name IS NULL OR first_name = '')
   OR (last_name IS NULL OR last_name = ''); 