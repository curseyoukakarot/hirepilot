-- Create enum for subscription plan tiers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
        CREATE TYPE plan_tier AS ENUM ('starter', 'pro', 'team');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_interval') THEN
        CREATE TYPE subscription_interval AS ENUM ('monthly', 'annual');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'past_due', 'canceled');
    END IF;
END$$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    plan_tier plan_tier NOT NULL DEFAULT 'starter',
    interval subscription_interval NOT NULL DEFAULT 'monthly',
    status subscription_status NOT NULL DEFAULT 'active',
    credits_granted INTEGER NOT NULL DEFAULT 350,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_credits INTEGER NOT NULL DEFAULT 0,
    used_credits INTEGER NOT NULL DEFAULT 0,
    remaining_credits INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit_usage_log table
CREATE TABLE IF NOT EXISTS credit_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    credits_used INTEGER NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_logs table for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT,
    event_type TEXT,
    event_data JSONB,
    processing_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create billing_history table
CREATE TABLE IF NOT EXISTS billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL,
    stripe_hosted_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_id ON credit_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_campaign_id ON credit_usage_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE credit_usage_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can modify their own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;
    DROP POLICY IF EXISTS "Users can modify their own credits" ON user_credits;
    DROP POLICY IF EXISTS "Users can view their own credit usage" ON credit_usage_log;
    DROP POLICY IF EXISTS "Users can create credit usage logs" ON credit_usage_log;
    DROP POLICY IF EXISTS "Users can view their own billing history" ON billing_history;

    -- Create new policies
    -- Policies for subscriptions
    CREATE POLICY "Users can view their own subscription"
        ON subscriptions FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can modify their own subscription"
        ON subscriptions FOR ALL
        USING (auth.uid() = user_id);

    -- Policies for user_credits
    CREATE POLICY "Users can view their own credits"
        ON user_credits FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can modify their own credits"
        ON user_credits FOR ALL
        USING (auth.uid() = user_id);

    -- Policies for credit_usage_log
    CREATE POLICY "Users can view their own credit usage"
        ON credit_usage_log FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can create credit usage logs"
        ON credit_usage_log FOR INSERT
        WITH CHECK (auth.uid() = user_id);

    -- Policies for billing_history
    CREATE POLICY "Users can view their own billing history"
        ON billing_history FOR SELECT
        USING (auth.uid() = user_id);
END$$;

-- Grant access to authenticated users
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON user_credits TO authenticated;
GRANT ALL ON credit_usage_log TO authenticated;
GRANT ALL ON billing_history TO authenticated; 