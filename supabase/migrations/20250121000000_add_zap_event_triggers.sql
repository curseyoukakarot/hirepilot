-- Add triggers to automatically emit Zapier events for database operations
-- This ensures events are captured even when operations happen outside the API layer

-- Function to emit Zapier events from database triggers
CREATE OR REPLACE FUNCTION emit_zap_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_event_data JSONB,
    p_source_table TEXT DEFAULT NULL,
    p_source_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO zap_events (
        user_id,
        event_type,
        event_data,
        source_table,
        source_id,
        created_at
    ) VALUES (
        p_user_id,
        p_event_type,
        p_event_data,
        p_source_table,
        p_source_id,
        NOW()
    );
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail the original operation
        RAISE WARNING 'Failed to emit zap event: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Update the existing message trigger to also emit Zapier events
CREATE OR REPLACE FUNCTION handle_message_insert()
RETURNS trigger AS $$
BEGIN
  -- Insert into email_events (existing functionality)
  INSERT INTO email_events (
    user_id,
    campaign_id,
    lead_id,
    provider,
    message_id,
    event_type,
    event_timestamp
  )
  VALUES (
    NEW.user_id,
    NEW.campaign_id,
    NEW.lead_id,
    NEW.provider,
    NEW.id::text,
    'sent',
    NEW.created_at
  );

  -- Update lead status (existing functionality)
  UPDATE leads
  SET status = 'Messaged',
      contacted_at = NEW.created_at
  WHERE id = NEW.lead_id;

  -- Emit Zapier event for message sent
  PERFORM emit_zap_event(
    NEW.user_id,
    'message_sent',
    jsonb_build_object(
      'id', NEW.id,
      'lead_id', NEW.lead_id,
      'campaign_id', NEW.campaign_id,
      'provider', NEW.provider,
      'subject', NEW.subject,
      'content', NEW.content,
      'status', NEW.status,
      'created_at', NEW.created_at
    ),
    'messages',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for candidate status changes
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

-- Trigger for pipeline creation
CREATE OR REPLACE FUNCTION handle_pipeline_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM emit_zap_event(
    NEW.user_id,
    'pipeline_created',
    jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'department', NEW.department,
      'created_at', NEW.created_at
    ),
    'pipelines',
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for email tracking events (opens, clicks, replies, bounces)
CREATE OR REPLACE FUNCTION handle_email_event_insert()
RETURNS trigger AS $$
BEGIN
  -- Map email event types to Zapier event types
  CASE NEW.event_type
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
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the actual triggers

-- Candidate update trigger (already has a messages trigger)
DROP TRIGGER IF EXISTS on_candidate_update ON candidates;
CREATE TRIGGER on_candidate_update
  AFTER UPDATE ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION handle_candidate_update();

-- Pipeline creation trigger
DROP TRIGGER IF EXISTS on_pipeline_insert ON pipelines;
CREATE TRIGGER on_pipeline_insert
  AFTER INSERT ON pipelines
  FOR EACH ROW
  EXECUTE FUNCTION handle_pipeline_insert();

-- Email events trigger
DROP TRIGGER IF EXISTS on_email_event_insert ON email_events;
CREATE TRIGGER on_email_event_insert
  AFTER INSERT ON email_events
  FOR EACH ROW
  EXECUTE FUNCTION handle_email_event_insert();

-- Trigger for candidate_jobs table (for pipeline stage movements)
CREATE OR REPLACE FUNCTION handle_candidate_job_update()
RETURNS trigger AS $$
DECLARE
  candidate_row candidates%ROWTYPE;
  stage_row pipeline_stages%ROWTYPE;
  old_stage_row pipeline_stages%ROWTYPE;
BEGIN
  -- Only emit events if stage_id actually changed
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    -- Get candidate info
    SELECT * INTO candidate_row FROM candidates WHERE id = NEW.candidate_id;
    
    -- Get new stage info
    SELECT * INTO stage_row FROM pipeline_stages WHERE id = NEW.stage_id;
    
    -- Get old stage info if it exists
    IF OLD.stage_id IS NOT NULL THEN
      SELECT * INTO old_stage_row FROM pipeline_stages WHERE id = OLD.stage_id;
    END IF;

    -- Emit dynamic pipeline stage event
    PERFORM emit_zap_event(
      candidate_row.user_id,
      'candidate_moved_to_' || LOWER(REPLACE(stage_row.title, ' ', '_')),
      jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'job_id', NEW.job_id,
        'stage_id', NEW.stage_id,
        'candidate', jsonb_build_object(
          'id', candidate_row.id,
          'first_name', candidate_row.first_name,
          'last_name', candidate_row.last_name,
          'email', candidate_row.email
        ),
        'new_stage', jsonb_build_object(
          'id', stage_row.id,
          'title', stage_row.title,
          'color', stage_row.color
        ),
        'old_stage', CASE 
          WHEN old_stage_row.id IS NOT NULL THEN 
            jsonb_build_object(
              'id', old_stage_row.id,
              'title', old_stage_row.title,
              'color', old_stage_row.color
            )
          ELSE NULL
        END,
        'moved_at', NEW.updated_at
      ),
      'candidate_jobs',
      NEW.id
    );

    -- Also emit a generic candidate_moved_to_stage event
    PERFORM emit_zap_event(
      candidate_row.user_id,
      'candidate_moved_to_stage',
      jsonb_build_object(
        'candidate_id', NEW.candidate_id,
        'job_id', NEW.job_id,
        'stage_id', NEW.stage_id,
        'stage_title', stage_row.title,
        'old_stage_title', COALESCE(old_stage_row.title, NULL),
        'candidate_name', candidate_row.first_name || ' ' || candidate_row.last_name,
        'candidate_email', candidate_row.email,
        'moved_at', NEW.updated_at
      ),
      'candidate_jobs',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for candidate_jobs stage changes
DROP TRIGGER IF EXISTS on_candidate_job_update ON candidate_jobs;
CREATE TRIGGER on_candidate_job_update
  AFTER UPDATE ON candidate_jobs
  FOR EACH ROW
  EXECUTE FUNCTION handle_candidate_job_update(); 