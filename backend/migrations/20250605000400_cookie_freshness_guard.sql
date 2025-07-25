CREATE OR REPLACE FUNCTION expire_old_cookies()
RETURNS trigger AS $$
BEGIN
  IF NEW.updated_at < NOW() - INTERVAL '24 hours' THEN
    NEW.valid := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cookie_freshness_guard ON linkedin_cookies;

CREATE TRIGGER cookie_freshness_guard
BEFORE UPDATE ON linkedin_cookies
FOR EACH ROW
EXECUTE FUNCTION expire_old_cookies(); 