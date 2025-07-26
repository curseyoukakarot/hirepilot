-- Recreate log_deduplication_decision with parameter order matching backend service
CREATE OR REPLACE FUNCTION public.log_deduplication_decision(
  p_user_id uuid,
  p_profile_url text,
  p_action text,
  p_reason text,
  p_rule_applied_id uuid DEFAULT NULL,
  p_previous_invite_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_puppet_job_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Simple insert into deduplication_log (stub implementation)
  INSERT INTO deduplication_log(
    id, created_at, action, user_id, campaign_id,
    profile_url, previous_invite_id, puppet_job_id,
    rule_applied_id, reason, message
  ) VALUES (
    gen_random_uuid(), NOW(), p_action, p_user_id, p_campaign_id,
    p_profile_url, p_previous_invite_id, p_puppet_job_id,
    p_rule_applied_id, p_reason, p_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure anon can execute
GRANT EXECUTE ON FUNCTION public.log_deduplication_decision(uuid, text, text, text, uuid, uuid, text, uuid, uuid) TO anon; 