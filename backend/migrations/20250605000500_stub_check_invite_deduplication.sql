CREATE OR REPLACE FUNCTION public.check_invite_deduplication(
  p_user_id uuid,
  p_profile_url text,
  p_campaign_id uuid DEFAULT NULL
) RETURNS TABLE (
  is_allowed boolean,
  reason text,
  message text,
  rule_applied text,
  previous_invite_id uuid,
  cooldown_expires_at timestamptz
) AS $$
BEGIN
  -- TODO: implement real deduplication logic.
  -- Temporary stub implementation that always allows the invite.
  RETURN QUERY
  SELECT
    true AS is_allowed,
    'first_time' AS reason,
    'No previous invite found (stub)' AS message,
    'no_rule' AS rule_applied,
    NULL::uuid AS previous_invite_id,
    NULL::timestamptz AS cooldown_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 