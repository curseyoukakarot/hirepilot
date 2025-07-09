-- Add scheduled_messages table for bulk message scheduling
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    content TEXT NOT NULL,
    template_id UUID,
    channel VARCHAR(50) NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);

-- Add foreign key constraints
ALTER TABLE scheduled_messages 
ADD CONSTRAINT fk_scheduled_messages_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE scheduled_messages 
ADD CONSTRAINT fk_scheduled_messages_lead_id 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

ALTER TABLE scheduled_messages 
ADD CONSTRAINT fk_scheduled_messages_template_id 
FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL; 