-- Fix credit_usage_log table schema to match code expectations
-- Add missing columns that the CreditService is trying to use

-- Add missing columns to credit_usage_log table
ALTER TABLE credit_usage_log 
    ADD COLUMN IF NOT EXISTS amount INTEGER,
    ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('credit', 'debit')),
    ADD COLUMN IF NOT EXISTS usage_type TEXT CHECK (usage_type IN ('campaign_creation', 'campaign_boost', 'api_usage')),
    ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing records to have proper values
-- Map existing credits_used to amount and set type based on sign
UPDATE credit_usage_log 
SET 
    amount = CASE 
        WHEN credits_used > 0 THEN credits_used
        ELSE -ABS(credits_used)
    END,
    type = CASE 
        WHEN credits_used > 0 THEN 'credit'
        ELSE 'debit'
    END,
    usage_type = 'api_usage',
    description = COALESCE(source, 'Credit usage')
WHERE amount IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_type ON credit_usage_log(type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_log_usage_type ON credit_usage_log(usage_type);

-- Add comment to explain the schema
COMMENT ON TABLE credit_usage_log IS 'Tracks credit allocations and usage. amount > 0 for credits, < 0 for debits.';
COMMENT ON COLUMN credit_usage_log.amount IS 'Credit amount: positive for additions, negative for usage';
COMMENT ON COLUMN credit_usage_log.type IS 'Type of transaction: credit (addition) or debit (usage)';
COMMENT ON COLUMN credit_usage_log.usage_type IS 'What the credits were used for: campaign_creation, campaign_boost, or api_usage';
COMMENT ON COLUMN credit_usage_log.description IS 'Human-readable description of the transaction'; 