-- Make legacy columns optional so new session rows can be created before cookie harvest
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='linkedin_sessions' AND column_name='enc_cookie'
  ) THEN
    EXECUTE 'ALTER TABLE public.linkedin_sessions ALTER COLUMN enc_cookie DROP NOT NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='linkedin_sessions' AND column_name='enc_li_at'
  ) THEN
    EXECUTE '' || 'ALTER TABLE public.linkedin_sessions ALTER COLUMN enc_li_at DROP NOT NULL';
  END IF;
END $$;


