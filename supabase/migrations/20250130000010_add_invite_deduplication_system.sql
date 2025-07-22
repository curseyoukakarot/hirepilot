-- Invite Deduplication System
-- Prevents duplicate LinkedIn invites with configurable cooldown rules

-- Create Enum Types (with safety checks)

-- Drop and recreate invite_status enum to ensure correct values
DO $$ BEGIN
  -- Drop existing enum if it exists (this will fail if tables are using it)
  DROP TYPE IF EXISTS invite_status CASCADE;
  
  -- Create the enum with all required values
  CREATE TYPE invite_status AS ENUM (
    'sent',
    'accepted', 
    'rejected',
    'expired',
    'withdrawn',
    'pending'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If drop fails due to dependencies, try to add missing values to existing enum
    BEGIN
      -- Try to add missing values one by one
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'sent';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'accepted';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'rejected';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'expired';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'withdrawn';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE invite_status ADD VALUE IF NOT EXISTS 'pending';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

DO $$ BEGIN
  -- Drop existing enum if it exists
  DROP TYPE IF EXISTS deduplication_action CASCADE;
  
  CREATE TYPE deduplication_action AS ENUM (
    'blocked',
    'allowed',
    'override'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If drop fails, try to add missing values to existing enum
    BEGIN
      ALTER TYPE deduplication_action ADD VALUE IF NOT EXISTS 'blocked';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_action ADD VALUE IF NOT EXISTS 'allowed';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_action ADD VALUE IF NOT EXISTS 'override';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

DO $$ BEGIN
  -- Drop existing enum if it exists
  DROP TYPE IF EXISTS deduplication_reason CASCADE;
  
  CREATE TYPE deduplication_reason AS ENUM (
    'duplicate',
    'cooldown_active',
    'permanently_blocked',
    'admin_override',
    'rule_exemption',
    'first_time'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If drop fails, try to add missing values to existing enum
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'duplicate';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'cooldown_active';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'permanently_blocked';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'admin_override';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'rule_exemption';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE deduplication_reason ADD VALUE IF NOT EXISTS 'first_time';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- Create ALL Tables First (Structure Only)

-- Check and create/modify tables carefully to avoid dependency issues

-- LinkedIn Sent Invites Table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'linkedin_sent_invites') THEN
    CREATE TABLE linkedin_sent_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      campaign_id UUID,
      original_profile_url TEXT NOT NULL,
      normalized_profile_url TEXT NOT NULL,
      profile_name TEXT,
      profile_title TEXT,
      profile_company TEXT,
      invite_message TEXT,
      message_template_id UUID,
      status invite_status DEFAULT 'sent' NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      status_updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      status_updated_by UUID,
      accepted_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      expired_at TIMESTAMPTZ,
      withdrawn_at TIMESTAMPTZ,
      source_lead_id UUID,
      puppet_job_id UUID,
      response_delay_hours INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  ELSE
    -- Add missing columns if table exists but has wrong structure
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS user_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS campaign_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS original_profile_url TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS normalized_profile_url TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS profile_name TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS profile_title TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS profile_company TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS invite_message TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS message_template_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS status invite_status DEFAULT 'sent';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS status_updated_by UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS source_lead_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS puppet_job_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS response_delay_hours INTEGER;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Ensure required columns have proper constraints
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN original_profile_url SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN normalized_profile_url SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN status SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN sent_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN status_updated_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN created_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE linkedin_sent_invites ALTER COLUMN updated_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- Invite Deduplication Rules Table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_deduplication_rules') THEN
    CREATE TABLE invite_deduplication_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name TEXT UNIQUE NOT NULL,
      status invite_status NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      cooldown_days INTEGER NOT NULL DEFAULT 0,
      is_permanent_block BOOLEAN DEFAULT false NOT NULL,
      priority INTEGER DEFAULT 100 NOT NULL,
      description TEXT,
      applies_to_user_types TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      created_by UUID
    );
  ELSE
    -- Add missing columns if table exists but has wrong structure
    
    -- Add status column (rename from invite_status if needed)
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS status invite_status;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Add all other required columns
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS cooldown_days INTEGER DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS is_permanent_block BOOLEAN DEFAULT false;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS description TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS applies_to_user_types TEXT[];
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD COLUMN IF NOT EXISTS created_by UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Try to drop the old column if it exists
    BEGIN
      ALTER TABLE invite_deduplication_rules DROP COLUMN IF EXISTS invite_status;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Ensure required columns have proper constraints
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN rule_name SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN status SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN 
      -- If status column doesn't exist or has issues, try to fix it
      BEGIN
        ALTER TABLE invite_deduplication_rules ALTER COLUMN status TYPE invite_status;
      EXCEPTION WHEN OTHERS THEN 
        -- Last resort: recreate the status column
        BEGIN
          ALTER TABLE invite_deduplication_rules DROP COLUMN IF EXISTS status;
          ALTER TABLE invite_deduplication_rules ADD COLUMN status invite_status NOT NULL DEFAULT 'sent';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN cooldown_days SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN is_active SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN is_permanent_block SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_rules ALTER COLUMN priority SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Add unique constraint on rule_name if missing
    BEGIN
      ALTER TABLE invite_deduplication_rules ADD CONSTRAINT invite_deduplication_rules_rule_name_key UNIQUE (rule_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- Invite Deduplication Log Table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_deduplication_log') THEN
    CREATE TABLE invite_deduplication_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      campaign_id UUID,
      puppet_job_id UUID,
      original_profile_url TEXT NOT NULL,
      normalized_profile_url TEXT NOT NULL,
      action deduplication_action NOT NULL,
      reason deduplication_reason NOT NULL,
      rule_applied_id UUID,
      previous_invite_id UUID,
      cooldown_expires_at TIMESTAMPTZ,
      message TEXT,
      metadata JSONB DEFAULT '{}',
      checked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  ELSE
    -- Add missing columns if table exists but has wrong structure
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS user_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS campaign_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS puppet_job_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS original_profile_url TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS normalized_profile_url TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS action deduplication_action;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS reason deduplication_reason;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS rule_applied_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS previous_invite_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS cooldown_expires_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS message TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Ensure required columns have proper constraints
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN original_profile_url SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN normalized_profile_url SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN action SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN reason SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_log ALTER COLUMN checked_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- Deduplication Override Table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invite_deduplication_overrides') THEN
    CREATE TABLE invite_deduplication_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      normalized_profile_url TEXT NOT NULL,
      override_type TEXT DEFAULT 'one_time' NOT NULL,
      expires_at TIMESTAMPTZ,
      reason TEXT NOT NULL,
      is_used BOOLEAN DEFAULT false NOT NULL,
      used_at TIMESTAMPTZ,
      used_by_job_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  ELSE
    -- Add missing columns if table exists but has wrong structure
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS user_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS normalized_profile_url TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS override_type TEXT DEFAULT 'one_time';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS reason TEXT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT false;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS used_by_job_id UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS created_by UUID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    -- Ensure required columns have proper constraints
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN normalized_profile_url SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN override_type SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN reason SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN is_used SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN created_by SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    BEGIN
      ALTER TABLE invite_deduplication_overrides ALTER COLUMN created_at SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- Force a transaction boundary here
COMMIT;
BEGIN;

-- Insert Default Data (after tables are fully committed)
INSERT INTO invite_deduplication_rules (rule_name, status, cooldown_days, is_permanent_block, priority, description) VALUES
  ('accepted_permanent', 'accepted', 0, true, 1, 'Never re-invite accepted connections'),
  ('rejected_long_cooldown', 'rejected', 90, false, 2, '90 day cooldown for rejected invites'),
  ('expired_medium_cooldown', 'expired', 30, false, 3, '30 day cooldown for expired invites'), 
  ('withdrawn_short_cooldown', 'withdrawn', 60, false, 4, '60 day cooldown for withdrawn invites'),
  ('pending_short_cooldown', 'pending', 7, false, 5, '7 day cooldown for pending invites'),
  ('sent_immediate_block', 'sent', 1, false, 6, '1 day minimum between invites')
ON CONFLICT (rule_name) DO NOTHING;

-- Now Add All Constraints, Indexes, Views, and Functions
-- (After tables are fully committed)

-- Add Foreign Key Constraints (with existence checks)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sent_invites_user_id' 
    AND table_name = 'linkedin_sent_invites'
  ) THEN
    ALTER TABLE linkedin_sent_invites 
      ADD CONSTRAINT fk_sent_invites_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dedup_log_user_id' 
    AND table_name = 'invite_deduplication_log'
  ) THEN
    ALTER TABLE invite_deduplication_log 
      ADD CONSTRAINT fk_dedup_log_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dedup_log_rule_id' 
    AND table_name = 'invite_deduplication_log'
  ) THEN
    ALTER TABLE invite_deduplication_log 
      ADD CONSTRAINT fk_dedup_log_rule_id 
      FOREIGN KEY (rule_applied_id) REFERENCES invite_deduplication_rules(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dedup_log_previous_invite' 
    AND table_name = 'invite_deduplication_log'
  ) THEN
    ALTER TABLE invite_deduplication_log 
      ADD CONSTRAINT fk_dedup_log_previous_invite 
      FOREIGN KEY (previous_invite_id) REFERENCES linkedin_sent_invites(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_override_user_id' 
    AND table_name = 'invite_deduplication_overrides'
  ) THEN
    ALTER TABLE invite_deduplication_overrides 
      ADD CONSTRAINT fk_override_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_override_created_by' 
    AND table_name = 'invite_deduplication_overrides'
  ) THEN
    ALTER TABLE invite_deduplication_overrides 
      ADD CONSTRAINT fk_override_created_by 
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Add Check Constraints (with existence checks)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_profile_urls' 
    AND table_name = 'linkedin_sent_invites'
  ) THEN
    ALTER TABLE linkedin_sent_invites 
      ADD CONSTRAINT valid_profile_urls CHECK (
        original_profile_url ~ '^https://.*linkedin\.com/in/.*' AND
        normalized_profile_url ~ '^https://.*linkedin\.com/in/.*'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_cooldown' 
    AND table_name = 'invite_deduplication_rules'
  ) THEN
    -- Fix existing data that would violate the constraint
    -- Update rows where is_permanent_block = false and cooldown_days = 0
    UPDATE invite_deduplication_rules 
    SET cooldown_days = 1 
    WHERE is_permanent_block = false AND cooldown_days = 0;
    
    -- Now add the constraint
    ALTER TABLE invite_deduplication_rules 
      ADD CONSTRAINT valid_cooldown CHECK (
        (is_permanent_block = true AND cooldown_days >= 0) OR
        (is_permanent_block = false AND cooldown_days > 0)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_override_expiry' 
    AND table_name = 'invite_deduplication_overrides'
  ) THEN
    ALTER TABLE invite_deduplication_overrides 
      ADD CONSTRAINT valid_override_expiry CHECK (
        (override_type = 'temporary' AND expires_at IS NOT NULL) OR
        (override_type != 'temporary')
      );
  END IF;
END $$;

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_sent_invites_user_normalized ON linkedin_sent_invites(user_id, normalized_profile_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_sent_invites_status ON linkedin_sent_invites(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_sent_invites_sent_at ON linkedin_sent_invites(sent_at);
CREATE INDEX IF NOT EXISTS idx_linkedin_sent_invites_campaign ON linkedin_sent_invites(campaign_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dedup_rules_status_active ON invite_deduplication_rules(status, is_active);
CREATE INDEX IF NOT EXISTS idx_dedup_rules_priority ON invite_deduplication_rules(priority);

CREATE INDEX IF NOT EXISTS idx_dedup_log_user_profile ON invite_deduplication_log(user_id, normalized_profile_url);
CREATE INDEX IF NOT EXISTS idx_dedup_log_checked_at ON invite_deduplication_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_dedup_log_action_reason ON invite_deduplication_log(action, reason);

CREATE INDEX IF NOT EXISTS idx_dedup_overrides_user_profile ON invite_deduplication_overrides(user_id, normalized_profile_url);
CREATE INDEX IF NOT EXISTS idx_dedup_overrides_expires_at ON invite_deduplication_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE linkedin_sent_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_deduplication_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_deduplication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_deduplication_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linkedin_sent_invites
CREATE POLICY "Users can view their own sent invites" ON linkedin_sent_invites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sent invites" ON linkedin_sent_invites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sent invites" ON linkedin_sent_invites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sent invites" ON linkedin_sent_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for invite_deduplication_rules
CREATE POLICY "All users can view deduplication rules" ON invite_deduplication_rules
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify deduplication rules" ON invite_deduplication_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for invite_deduplication_log
CREATE POLICY "Users can view their own deduplication logs" ON invite_deduplication_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert deduplication logs" ON invite_deduplication_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all deduplication logs" ON invite_deduplication_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for invite_deduplication_overrides
CREATE POLICY "Users can view their own overrides" ON invite_deduplication_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only admins can create overrides" ON invite_deduplication_overrides
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can manage overrides" ON invite_deduplication_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create Views
CREATE OR REPLACE VIEW invite_deduplication_summary AS
SELECT 
  u.email as user_email,
  COUNT(*) as total_invites,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
  COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours') as invites_last_24h,
  COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '7 days') as invites_last_7d,
  COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '30 days') as invites_last_30d,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected', 'expired')) > 0 THEN
      ROUND((COUNT(*) FILTER (WHERE status = 'accepted')::DECIMAL / 
             COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected', 'expired'))) * 100, 2)
    ELSE 0
  END as acceptance_rate_percent,
  (
    SELECT COUNT(*) 
    FROM invite_deduplication_log idl 
    WHERE idl.user_id = lsi.user_id 
    AND idl.action = 'blocked'
    AND idl.checked_at > NOW() - INTERVAL '30 days'
  ) as duplicates_blocked_30d
FROM linkedin_sent_invites lsi
JOIN auth.users u ON lsi.user_id = u.id
GROUP BY lsi.user_id, u.email;

CREATE OR REPLACE VIEW active_invite_cooldowns AS
SELECT 
  lsi.user_id,
  u.email as user_email,
  lsi.normalized_profile_url,
  lsi.original_profile_url,
  lsi.profile_name,
  lsi.status,
  lsi.sent_at,
  lsi.status_updated_at,
  idr.cooldown_days,
  idr.is_permanent_block,
  CASE 
    WHEN idr.is_permanent_block THEN NULL
    ELSE lsi.status_updated_at + (idr.cooldown_days || ' days')::INTERVAL
  END as cooldown_expires_at,
  CASE 
    WHEN idr.is_permanent_block THEN 'Permanent'
    WHEN lsi.status_updated_at + (idr.cooldown_days || ' days')::INTERVAL > NOW() THEN
      EXTRACT(DAYS FROM (lsi.status_updated_at + (idr.cooldown_days || ' days')::INTERVAL) - NOW()) || ' days'
    ELSE 'Expired'
  END as time_remaining,
  idr.rule_name,
  idr.description as rule_description
FROM linkedin_sent_invites lsi
JOIN auth.users u ON lsi.user_id = u.id
JOIN invite_deduplication_rules idr ON idr.status = lsi.status AND idr.is_active = true
WHERE 
  (idr.is_permanent_block = true) OR 
  (lsi.status_updated_at + (idr.cooldown_days || ' days')::INTERVAL > NOW())
ORDER BY lsi.status_updated_at DESC;

-- Create Functions
CREATE OR REPLACE FUNCTION normalize_linkedin_url(url TEXT) 
RETURNS TEXT AS $$
BEGIN
  RETURN lower(split_part(url, '?', 1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_invite_deduplication(
  p_user_id UUID,
  p_profile_url TEXT,
  p_campaign_id UUID DEFAULT NULL
) RETURNS TABLE (
  is_allowed BOOLEAN,
  reason deduplication_reason,
  cooldown_expires_at TIMESTAMPTZ,
  previous_invite_id UUID,
  rule_applied TEXT,
  message TEXT
) AS $$
DECLARE
  v_normalized_url TEXT;
  v_existing_invite linkedin_sent_invites%ROWTYPE;
  v_rule invite_deduplication_rules%ROWTYPE;
  v_override invite_deduplication_overrides%ROWTYPE;
BEGIN
  v_normalized_url := normalize_linkedin_url(p_profile_url);
  
  SELECT * INTO v_override
  FROM invite_deduplication_overrides 
  WHERE user_id = p_user_id 
    AND normalized_profile_url = v_normalized_url
    AND is_used = false
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      true,
      'admin_override'::deduplication_reason,
      NULL::TIMESTAMPTZ,
      NULL::UUID,
      'admin_override',
      'Admin override active for this profile';
    RETURN;
  END IF;
  
  SELECT * INTO v_existing_invite
  FROM linkedin_sent_invites 
  WHERE user_id = p_user_id 
    AND normalized_profile_url = v_normalized_url
  ORDER BY sent_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      true,
      'first_time'::deduplication_reason,
      NULL::TIMESTAMPTZ,
      NULL::UUID,
      'first_time',
      'No previous invite found for this profile';
    RETURN;
  END IF;
  
  SELECT * INTO v_rule
  FROM invite_deduplication_rules
  WHERE status = v_existing_invite.status
    AND is_active = true
  ORDER BY priority ASC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      true,
      'rule_exemption'::deduplication_reason,
      NULL::TIMESTAMPTZ,
      v_existing_invite.id,
      'no_rule',
      'No deduplication rule found for status: ' || v_existing_invite.status::text;
    RETURN;
  END IF;
  
  IF v_rule.is_permanent_block THEN
    RETURN QUERY SELECT 
      false,
      'permanently_blocked'::deduplication_reason,
      NULL::TIMESTAMPTZ,
      v_existing_invite.id,
      v_rule.rule_name,
      format('Permanently blocked due to %s status', v_existing_invite.status);
    RETURN;
  END IF;
  
  IF v_existing_invite.status_updated_at + (v_rule.cooldown_days || ' days')::INTERVAL > NOW() THEN
    RETURN QUERY SELECT 
      false,
      'cooldown_active'::deduplication_reason,
      v_existing_invite.status_updated_at + (v_rule.cooldown_days || ' days')::INTERVAL,
      v_existing_invite.id,
      v_rule.rule_name,
      format('Cooldown active until %s', 
        (v_existing_invite.status_updated_at + (v_rule.cooldown_days || ' days')::INTERVAL)::date);
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true,
    'first_time'::deduplication_reason,
    v_existing_invite.status_updated_at + (v_rule.cooldown_days || ' days')::INTERVAL,
    v_existing_invite.id,
    v_rule.rule_name,
    'Cooldown expired, reinvite allowed';
       
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_linkedin_invite(
  p_user_id UUID,
  p_profile_url TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_invite_message TEXT DEFAULT NULL,
  p_profile_name TEXT DEFAULT NULL,
  p_profile_title TEXT DEFAULT NULL,
  p_profile_company TEXT DEFAULT NULL,
  p_puppet_job_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_invite_id UUID;
  v_normalized_url TEXT;
BEGIN
  v_normalized_url := normalize_linkedin_url(p_profile_url);
  
  INSERT INTO linkedin_sent_invites (
    user_id,
    campaign_id,
    original_profile_url,
    normalized_profile_url,
    invite_message,
    profile_name,
    profile_title,
    profile_company,
    puppet_job_id,
    status
  ) VALUES (
    p_user_id,
    p_campaign_id,
    p_profile_url,
    v_normalized_url,
    p_invite_message,
    p_profile_name,
    p_profile_title,
    p_profile_company,
    p_puppet_job_id,
    'sent'
  ) RETURNING id INTO v_invite_id;
  
  RETURN v_invite_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_invite_status(
  p_invite_id UUID,
  p_new_status invite_status,
  p_updated_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE linkedin_sent_invites 
  SET 
    status = p_new_status,
    status_updated_at = NOW(),
    status_updated_by = p_updated_by,
    updated_at = NOW(),
    accepted_at = CASE WHEN p_new_status = 'accepted' THEN NOW() ELSE accepted_at END,
    rejected_at = CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_at END,
    expired_at = CASE WHEN p_new_status = 'expired' THEN NOW() ELSE expired_at END,
    withdrawn_at = CASE WHEN p_new_status = 'withdrawn' THEN NOW() ELSE withdrawn_at END
  WHERE id = p_invite_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_deduplication_decision(
  p_user_id UUID,
  p_profile_url TEXT,
  p_action deduplication_action,
  p_reason deduplication_reason,
  p_rule_applied_id UUID DEFAULT NULL,
  p_previous_invite_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_puppet_job_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_normalized_url TEXT;
BEGIN
  v_normalized_url := normalize_linkedin_url(p_profile_url);
  
  INSERT INTO invite_deduplication_log (
    user_id,
    campaign_id,
    puppet_job_id,
    original_profile_url,
    normalized_profile_url,
    action,
    reason,
    rule_applied_id,
    previous_invite_id,
    message
  ) VALUES (
    p_user_id,
    p_campaign_id,
    p_puppet_job_id,
    p_profile_url,
    v_normalized_url,
    p_action,
    p_reason,
    p_rule_applied_id,
    p_previous_invite_id,
    p_message
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql; 