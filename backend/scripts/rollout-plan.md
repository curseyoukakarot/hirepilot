# Rollout Plan: Enhanced Reply Tracking System

## Overview

This plan outlines the safe deployment of the enhanced reply tracking system with short tokens, sender identities, and improved threading.

## Phase 1: Pre-Deployment (Day -7 to -1)

### Database Migrations
```bash
# Deploy migrations to staging
supabase db push --linked --environment staging

# Verify migrations on staging
psql $STAGING_DATABASE_URL -c "
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('email_identities', 'reply_tokens');
"

# Check new columns exist
psql $STAGING_DATABASE_URL -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('sender_identity_id', 'from_email', 'message_id_header');
"
```

### Environment Configuration
```bash
# Add to production environment
INBOUND_PARSE_DOMAIN=reply.thehirepilot.com
SEND_DOMAIN=thehirepilot.com
FORWARD_FROM_EMAIL=replies@thehirepilot.com
FORWARD_FROM_NAME=HirePilot Replies

# Verify SendGrid domain authentication
# - Ensure reply.thehirepilot.com is configured for inbound parse
# - Ensure thehirepilot.com is authenticated for sending
# - Verify replies@thehirepilot.com sender identity exists
```

### Code Review Checklist
- [ ] All database queries use proper error handling
- [ ] Backward compatibility maintained for legacy VERP
- [ ] Loop protection mechanisms in place
- [ ] Token generation is cryptographically secure
- [ ] No breaking changes to existing APIs
- [ ] Proper logging for debugging

## Phase 2: Staging Deployment (Day 0)

### Deploy to Staging
```bash
# Deploy backend changes
git checkout main
git pull origin main
npm run build
npm run deploy:staging

# Run automated tests
npm run test:reply-tracking

# Run manual verification
ts-node scripts/test-reply-tracking.ts
```

### Staging Verification
1. **Send Test Messages**
   - Create test sender identity
   - Send messages via new system
   - Verify short tokens in Reply-To headers
   - Confirm database metadata is stored

2. **Test Inbound Processing**
   - Reply to test messages
   - Verify token resolution works
   - Confirm legacy VERP fallback
   - Check forwarding to correct identity inbox

3. **Verify Analytics**
   - Confirm reply events are tracked
   - Check email metrics still calculate correctly
   - Verify campaign performance data intact

### Performance Testing
```bash
# Load test token generation
node -e "
const { newReplyToken } = require('./lib/replyToken');
console.time('1000-tokens');
for(let i=0; i<1000; i++) newReplyToken();
console.timeEnd('1000-tokens');
"

# Test database performance
psql $STAGING_DATABASE_URL -c "
EXPLAIN ANALYZE 
SELECT rt.* FROM reply_tokens rt 
JOIN messages m ON m.id = rt.message_id 
WHERE rt.token = 'test123';
"
```

## Phase 3: Production Deployment (Day 1)

### Pre-Deployment Checklist
- [ ] Staging tests all pass
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

### Deploy Database Migrations
```bash
# Backup production database
pg_dump $PRODUCTION_DATABASE_URL > backup-$(date +%Y%m%d).sql

# Apply migrations (idempotent)
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20250821_add_email_identities_and_msg_link.sql
psql $PRODUCTION_DATABASE_URL -f supabase/migrations/20250821_add_reply_tokens.sql

# Verify migrations
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*) as email_identities_count FROM email_identities;
SELECT COUNT(*) as reply_tokens_count FROM reply_tokens;
"
```

### Deploy Application Code
```bash
# Deploy with zero-downtime strategy
npm run deploy:production

# Verify deployment
curl -f https://api.thehirepilot.com/health
```

### Post-Deployment Verification
```bash
# Test one message end-to-end
curl -X POST https://api.thehirepilot.com/api/sendgrid/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "user_id": "test-user-id",
    "to": "test@example.com", 
    "subject": "Production Test",
    "html": "<p>Testing new reply system</p>"
  }'

# Check database state
psql $PRODUCTION_DATABASE_URL -c "
SELECT COUNT(*) FROM reply_tokens WHERE created_at > NOW() - INTERVAL '1 hour';
"
```

## Phase 4: Gradual Rollout (Day 1-7)

### Monitor Key Metrics
```sql
-- Daily monitoring queries
SELECT 
  DATE(created_at) as date,
  COUNT(*) as messages_sent,
  COUNT(CASE WHEN sender_identity_id IS NOT NULL THEN 1 END) as with_identity,
  COUNT(CASE WHEN message_id_header IS NOT NULL THEN 1 END) as with_headers
FROM messages 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Reply token usage
SELECT 
  DATE(created_at) as date,
  COUNT(*) as tokens_created
FROM reply_tokens 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Inbound reply processing
SELECT 
  DATE(reply_ts) as date,
  COUNT(*) as replies_processed
FROM email_replies 
WHERE reply_ts > NOW() - INTERVAL '7 days'
GROUP BY DATE(reply_ts)
ORDER BY date DESC;
```

### Error Monitoring
```bash
# Check application logs for errors
grep -i "reply.*error\|token.*error" /var/log/hirepilot/app.log

# Monitor SendGrid webhook failures
grep "sendgrid/inbound.*error" /var/log/hirepilot/app.log

# Check database errors
psql $PRODUCTION_DATABASE_URL -c "
SELECT * FROM pg_stat_database_conflicts 
WHERE datname = 'hirepilot';
"
```

### User Feedback Collection
- Monitor support tickets for reply-related issues
- Check user reports of missing replies
- Verify threading improvements in Gmail/Outlook
- Collect feedback on Reply-To display names

## Phase 5: Legacy Cleanup (Day 30-60)

### Assess Legacy Usage
```sql
-- Check if any legacy VERP addresses are still being used
SELECT 
  COUNT(*) as legacy_replies,
  COUNT(CASE WHEN metadata->>'via' = 'legacy' THEN 1 END) as via_legacy,
  COUNT(CASE WHEN metadata->>'via' = 'token' THEN 1 END) as via_token
FROM email_events 
WHERE event_type = 'reply' 
AND created_at > NOW() - INTERVAL '30 days';
```

### Optional: Add Token Expiration
```sql
-- Add TTL to reply tokens (optional)
ALTER TABLE reply_tokens 
ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days');

-- Create cleanup job
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM reply_tokens 
  WHERE expires_at IS NOT NULL 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (add to cron)
SELECT cron.schedule('cleanup-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');
```

## Rollback Plan

### If Issues Detected in First 24 Hours

1. **Immediate Rollback**
   ```bash
   # Revert to previous application version
   git revert HEAD
   npm run deploy:production
   ```

2. **Database Rollback** (if needed)
   ```sql
   -- Remove new columns (data preserved)
   ALTER TABLE messages 
   DROP COLUMN IF EXISTS sender_identity_id,
   DROP COLUMN IF EXISTS from_email,
   DROP COLUMN IF EXISTS message_id_header;
   
   -- Drop new tables (if no critical data)
   DROP TABLE IF EXISTS reply_tokens;
   DROP TABLE IF EXISTS email_identities;
   ```

3. **Restore Legacy Behavior**
   - All new messages will use legacy VERP Reply-To
   - Existing reply processing continues to work
   - No data loss occurs

### Rollback Triggers
- Reply processing failure rate > 5%
- Forwarding delivery rate drops > 10%
- Database performance degradation
- Critical user complaints about missing replies

## Success Metrics

### Week 1 Targets
- [ ] 0 critical reply processing failures
- [ ] >95% of new messages use short tokens
- [ ] >90% of replies forwarded to correct identity inbox
- [ ] <1% increase in support tickets

### Month 1 Targets  
- [ ] >99% reply processing success rate
- [ ] Improved email threading reported by users
- [ ] Legacy VERP usage <10% of total replies
- [ ] No performance regressions

### Long-term Goals
- [ ] Enhanced sender identity management UI
- [ ] Advanced reply routing rules
- [ ] Reply analytics dashboard improvements
- [ ] Integration with CRM threading

## Communication Plan

### Internal Team
- **Day -7**: Engineering team briefed on changes
- **Day -1**: Support team trained on new system  
- **Day 0**: Deployment notification to all teams
- **Day +1**: Status update to leadership
- **Day +7**: Weekly rollout report

### External Users
- **Day 0**: No user-facing changes (transparent upgrade)
- **Week 2**: Optional blog post about improved threading
- **Month 1**: Feature announcement for identity management

## Monitoring & Alerting

### Key Alerts
```yaml
# Alert if reply token creation fails
- name: reply_token_creation_failure
  condition: error_rate > 1%
  action: page_oncall

# Alert if inbound processing fails  
- name: inbound_reply_processing_failure
  condition: error_rate > 5%
  action: slack_alert

# Alert if forwarding fails
- name: reply_forwarding_failure
  condition: delivery_rate < 90%
  action: email_team
```

### Dashboard Metrics
- Messages sent with new system vs legacy
- Reply token creation rate
- Inbound reply processing success rate
- Forwarding delivery rate by identity
- Threading improvement metrics (if measurable)

This rollout plan ensures a safe, monitored deployment with clear success criteria and rollback procedures.
