-- Fix the email event trigger CASE statement to handle 'sent' events and add ELSE clause
CREATE OR REPLACE FUNCTION handle_email_event_insert()
RETURNS trigger AS $$
BEGIN
  -- Map email event types to Zapier event types
  CASE NEW.event_type
    WHEN 'sent' THEN
      PERFORM emit_zap_event(
        NEW.user_id,
        'message_sent',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'campaign_id', NEW.campaign_id,
          'message_id', NEW.message_id,
          'provider', NEW.provider,
          'event_timestamp', NEW.event_timestamp,
          'metadata', NEW.metadata
        ),
        'email_events',
        NEW.id
      );
    WHEN 'open' THEN
      PERFORM emit_zap_event(
        NEW.user_id,
        'email_opened',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'campaign_id', NEW.campaign_id,
          'message_id', NEW.message_id,
          'provider', NEW.provider,
          'event_timestamp', NEW.event_timestamp,
          'metadata', NEW.metadata
        ),
        'email_events',
        NEW.id
      );
    WHEN 'click' THEN
      PERFORM emit_zap_event(
        NEW.user_id,
        'email_clicked',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'campaign_id', NEW.campaign_id,
          'message_id', NEW.message_id,
          'provider', NEW.provider,
          'event_timestamp', NEW.event_timestamp,
          'metadata', NEW.metadata
        ),
        'email_events',
        NEW.id
      );
    WHEN 'reply' THEN
      PERFORM emit_zap_event(
        NEW.user_id,
        'message_reply',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'campaign_id', NEW.campaign_id,
          'message_id', NEW.message_id,
          'provider', NEW.provider,
          'event_timestamp', NEW.event_timestamp,
          'metadata', NEW.metadata
        ),
        'email_events',
        NEW.id
      );
    WHEN 'bounce' THEN
      PERFORM emit_zap_event(
        NEW.user_id,
        'email_bounced',
        jsonb_build_object(
          'id', NEW.id,
          'lead_id', NEW.lead_id,
          'campaign_id', NEW.campaign_id,
          'message_id', NEW.message_id,
          'provider', NEW.provider,
          'event_timestamp', NEW.event_timestamp,
          'metadata', NEW.metadata
        ),
        'email_events',
        NEW.id
      );
    ELSE
      -- For any other event types (delivered, etc.), just log a warning
      -- Don't emit an event but don't fail either
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix the candidate update trigger CASE statement to include missing 'hired' WHEN clause
CREATE OR REPLACE FUNCTION handle_candidate_update()
RETURNS trigger AS $$
BEGIN
  -- Only emit events if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Emit general candidate updated event
    PERFORM emit_zap_event(
      NEW.user_id,
      'candidate_updated',
      jsonb_build_object(
        'id', NEW.id,
        'first_name', NEW.first_name,
        'last_name', NEW.last_name,
        'email', NEW.email,
        'phone', NEW.phone,
        'status', NEW.status,
        'old_status', OLD.status,
        'lead_id', NEW.lead_id,
        'updated_at', NEW.updated_at
      ),
      'candidates',
      NEW.id
    );

    -- Emit specific status-based events
    CASE NEW.status
      WHEN 'interviewed' THEN
        PERFORM emit_zap_event(
          NEW.user_id,
          'candidate_interviewed',
          jsonb_build_object(
            'id', NEW.id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'previous_status', OLD.status,
            'interviewed_at', NEW.updated_at
          ),
          'candidates',
          NEW.id
        );
      WHEN 'offered' THEN
        PERFORM emit_zap_event(
          NEW.user_id,
          'candidate_offered',
          jsonb_build_object(
            'id', NEW.id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'previous_status', OLD.status,
            'offered_at', NEW.updated_at
          ),
          'candidates',
          NEW.id
        );
      WHEN 'hired' THEN
        PERFORM emit_zap_event(
          NEW.user_id,
          'candidate_hired',
          jsonb_build_object(
            'id', NEW.id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'previous_status', OLD.status,
            'hired_at', NEW.updated_at
          ),
          'candidates',
          NEW.id
        );
      WHEN 'rejected' THEN
        PERFORM emit_zap_event(
          NEW.user_id,
          'candidate_rejected',
          jsonb_build_object(
            'id', NEW.id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'previous_status', OLD.status,
            'rejected_at', NEW.updated_at
          ),
          'candidates',
          NEW.id
        );
      ELSE
        -- For any other status change, emit a generic pipeline stage event
        PERFORM emit_zap_event(
          NEW.user_id,
          'pipeline_stage_updated',
          jsonb_build_object(
            'candidate_id', NEW.id,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email,
            'old_stage', OLD.status,
            'new_stage', NEW.status,
            'updated_at', NEW.updated_at
          ),
          'candidates',
          NEW.id
        );
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 