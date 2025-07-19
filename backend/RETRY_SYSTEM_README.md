# 🔄 Retry + Backoff System Documentation

## Overview
The Retry + Backoff System automatically retries failed puppet jobs with exponential backoff, intelligent error classification, and comprehensive logging. This system prevents temporary failures from becoming permanent failures and provides detailed analytics on retry patterns.

## 🏗️ Architecture

### Database Schema
- **`puppet_jobs`** - Extended with retry columns (`retry_count`, `next_retry_at`, `last_attempt_at`, `max_retries`, `retry_enabled`)
- **`puppet_job_retry_history`** - Logs every retry attempt with detailed metadata
- **`puppet_job_retry_config`** - Configurable retry settings per job type

### Core Services
- **`RetryManager`** - Main retry orchestration and scheduling
- **`RetryHistoryService`** - Logging, analytics, and history tracking
- **`CronProcessor`** - Enhanced with retry job processing
- **`JobExecutor`** - Integrated with automatic retry scheduling

## 🚀 Features

### ✅ Exponential Backoff
- **Base delay**: 2 hours (configurable per job type)
- **Backoff multiplier**: 2x (exponential growth)
- **Max delay**: 24 hours (prevents excessive delays)
- **Jitter**: Up to 5 minutes (prevents thundering herd)

### ✅ Smart Error Classification
**Will Retry:**
- `timeout` - Network or execution timeouts
- `network` - Connectivity issues
- `rate_limit` - API rate limiting
- `temporary_error` - Transient failures

**Will NOT Retry:**
- `authentication` - Invalid credentials
- `permission` - Access denied
- `validation_error` - Invalid job configuration

### ✅ Configurable Per Job Type
- **`default`** - 5 retries, 2-hour base delay
- **`linkedin_outreach`** - Optimized for LinkedIn API limits
- **`email_campaign`** - Optimized for email delivery
- **`data_enrichment`** - Optimized for data processing

### ✅ Comprehensive Analytics
- Success/failure rates by job type
- Average attempts to success
- Common error patterns
- Retry distribution analysis
- Performance metrics

## 📊 Usage Examples

### Basic Retry Scheduling
```typescript
import { retryManager } from './services/puppet/retryManager';

// Schedule retry for a failed job
const retryScheduled = await retryManager.scheduleRetry(
  jobId,
  'Network timeout occurred',
  'network',
  'executor-id'
);

console.log(`Retry scheduled: ${retryScheduled}`);
```

### Get Retry History
```typescript
import { retryHistoryService } from './services/puppet/retryHistoryService';

// Get retry history for a specific job
const history = await retryHistoryService.getJobRetryHistory(jobId);
console.log(`Job has ${history.length} retry attempts`);

// Get retry analytics
const analytics = await retryHistoryService.getRetryAnalytics({
  jobType: 'linkedin_outreach',
  startDate: '2024-01-01T00:00:00Z'
});
console.log(`Success rate: ${analytics.successfulRetries / analytics.totalRetries * 100}%`);
```

### Process Retry Jobs
```typescript
import { CronProcessor } from './services/puppet/cronProcessor';

const processor = new CronProcessor({
  processorId: 'retry-processor',
  batchSize: 20,
  processRetryJobs: true // Enable retry processing
});

// Process both regular and retry jobs
const result = await processor.processFullBatch();
console.log(`Processed ${result.retriedJobs} retry jobs`);
```

## 🔧 Configuration

### Retry Configuration per Job Type
```sql
-- Update retry configuration for a specific job type
UPDATE puppet_job_retry_config 
SET 
  max_retries = 3,
  base_delay_seconds = 3600, -- 1 hour
  backoff_multiplier = 1.5,
  max_delay_seconds = 43200 -- 12 hours
WHERE job_type = 'linkedin_outreach';
```

### Job-Level Retry Settings
```typescript
// Create job with custom retry settings
const { data } = await supabase.from('puppet_jobs').insert({
  user_id: userId,
  job_type: 'custom_job',
  job_config: { /* job data */ },
  retry_enabled: true,
  max_retries: 7, // Override default
  priority: 5
});
```

## 📈 Monitoring & Analytics

### Database Views for Monitoring
```sql
-- Jobs currently scheduled for retry
SELECT 
  id, job_type, retry_count, next_retry_at,
  EXTRACT(EPOCH FROM (next_retry_at - NOW())) / 60 as minutes_until_retry
FROM puppet_jobs 
WHERE final_status = 'failed' 
  AND next_retry_at > NOW() 
  AND retry_enabled = true;

-- Retry success rates by job type
SELECT 
  pj.job_type,
  COUNT(*) as total_retries,
  SUM(CASE WHEN prh.success THEN 1 ELSE 0 END) as successful_retries,
  ROUND(AVG(CASE WHEN prh.success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate_percent
FROM puppet_job_retry_history prh
JOIN puppet_jobs pj ON prh.job_id = pj.id
WHERE prh.attempted_at >= NOW() - INTERVAL '7 days'
GROUP BY pj.job_type
ORDER BY total_retries DESC;
```

### API Endpoints
```typescript
// Get retry analytics for dashboard
GET /api/puppet/retry-analytics?jobType=linkedin_outreach&days=30

// Get jobs needing escalation
GET /api/puppet/failed-jobs?status=permanently_failed&retryCount=>5

// Manual retry scheduling
POST /api/puppet/jobs/:jobId/retry
{
  "reason": "manual_retry",
  "errorType": "manual_intervention"
}
```

## 🧪 Testing

### Run Comprehensive Tests
```bash
cd backend
npm run test:retry-system
# or
npx ts-node testRetrySystem.ts
```

### Test Coverage
- ✅ Database schema validation
- ✅ Retry function testing
- ✅ Exponential backoff calculation
- ✅ Error type classification
- ✅ History logging
- ✅ Analytics generation
- ✅ End-to-end retry flow

## 🔍 Troubleshooting

### Common Issues

**Jobs not retrying:**
1. Check `retry_enabled = true` on the job
2. Verify error type is in `retry_on_error_types` array
3. Ensure `retry_count < max_retries`

**Excessive delays:**
1. Check `max_delay_seconds` in retry config
2. Verify backoff multiplier isn't too high
3. Review jitter settings

**Missing retry history:**
1. Verify RLS policies allow access
2. Check service role permissions
3. Ensure retry attempts are being logged

### Debug Queries
```sql
-- Check retry configuration
SELECT * FROM puppet_job_retry_config WHERE enabled = true;

-- See pending retries
SELECT * FROM get_jobs_ready_for_retry(10);

-- Analyze retry patterns
SELECT 
  error_type, 
  COUNT(*) as count,
  AVG(delay_seconds) as avg_delay
FROM puppet_job_retry_history 
WHERE attempted_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY count DESC;
```

## 🎯 Key Benefits

1. **🛡️ Resilience** - Automatic recovery from temporary failures
2. **📊 Visibility** - Comprehensive retry analytics and monitoring
3. **⚙️ Flexibility** - Configurable per job type and error classification
4. **🚀 Performance** - Intelligent backoff prevents system overload
5. **🔍 Debugging** - Detailed history and error tracking

## 📝 Migration Summary

The retry system was implemented with these key migrations:

1. **`SIMPLE_RETRY_MIGRATION.sql`** - Core database schema
2. **`RETRY_FUNCTION_FIX.sql`** - Database functions fix
3. **Enhanced Services** - Updated `cronProcessor.ts`, `jobExecutor.ts`
4. **New Services** - Added `retryManager.ts`, `retryHistoryService.ts`

**Total Implementation**: Complete Retry + Backoff System ✅

---

🎉 **The retry system is now fully operational and ready for production use!** 