# 🚀 Cron Processor System - Complete Setup Guide

## 🎯 What We've Built

A comprehensive **automated job processing system** with:

✅ **Concurrency-Safe Batch Processing** - No duplicate executions  
✅ **Per-User Job Limits** - Max 2 jobs per user simultaneously  
✅ **Timeout Management** - Automatic stuck job recovery  
✅ **Execution History & Analytics** - Detailed performance tracking  
✅ **Error Recovery** - Retry integration and failure handling  
✅ **Real-time Monitoring** - Health checks and metrics  
✅ **Slack Alerts** - Automatic failure notifications  
✅ **REST API** - Complete management interface  

## 📁 Files Created

### Database Layer
- `supabase/migrations/20250130000011_add_cron_concurrency_system.sql` - Complete database schema

### Core Services
- `backend/services/puppet/cronProcessor.ts` - Main orchestrator
- `backend/services/puppet/concurrencyManager.ts` - Job locking & limits
- `backend/services/puppet/batchJobLoader.ts` - Safe job fetching
- `backend/services/puppet/jobExecutor.ts` - Job execution wrapper
- `backend/services/puppet/executionHistoryService.ts` - Analytics & insights

### API Layer
- `backend/api/cronProcessor.ts` - REST API endpoints
- `backend/routes/cronProcessor.ts` - Route configuration

### Documentation & Testing
- `backend/services/puppet/README.md` - Comprehensive documentation
- `backend/scripts/testCronProcessor.ts` - Test suite & demo

## 🚀 Quick Start (5 minutes)

### 1. Apply Database Migration

```bash
# Navigate to your project root
cd /Users/brandonomoregie/Desktop/Projects/hirepilot_

# Apply the migration via Supabase CLI or Dashboard
supabase db push
# OR copy the SQL from the migration file to your database
```

### 2. Environment Setup

Add to your `.env` file:

```env
# Already have these
SUPABASE_URL=your_existing_url
SUPABASE_SERVICE_ROLE_KEY=your_existing_key

# Optional new ones
CRON_WEBHOOK_SECRET=your_secure_webhook_secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ENABLE_SLACK_ALERTS=true
```

### 3. Start the System

**Option A: Auto-start on Server Boot**
```typescript
// Add to your backend/server.ts or main app file
import CronProcessor from './services/puppet/cronProcessor';

const cronProcessor = new CronProcessor({
  batchSize: 20,
  maxConcurrentJobs: 10,
  enableSlackAlerts: true
});

cronProcessor.start();
```

**Option B: Manual Control via API**
```bash
# Start the processor
curl -X POST http://localhost:8080/api/cron/start \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 20, "maxConcurrentJobs": 10}'
```

### 4. Test the System

```bash
# Run the test suite
cd backend
npx ts-node scripts/testCronProcessor.ts

# Or test specific components
npx ts-node scripts/testCronProcessor.ts processor
npx ts-node scripts/testCronProcessor.ts api  
npx ts-node scripts/testCronProcessor.ts metrics
```

## 🔄 Integration with Your Existing System

### No Changes Required! 
Your existing job creation code keeps working. The system automatically processes jobs with:
- `status = 'pending'`
- `scheduled_at <= NOW()`
- `final_status IS NULL`

### Enhanced Features Added:
- **Concurrency fields** to `puppet_jobs` table
- **Execution tracking** in new `puppet_job_execution_logs` table
- **Processor coordination** in `puppet_cron_processor_state` table

## 📊 Monitoring & Management

### Health Check
```bash
curl http://localhost:8080/api/cron/health
```

### Get Status
```bash
curl http://localhost:8080/api/cron/status
```

### View Analytics
```bash
curl "http://localhost:8080/api/cron/metrics?startDate=2024-01-01&endDate=2024-01-31"
```

### Manual Trigger
```bash
curl -X POST http://localhost:8080/api/cron/trigger
```

### Reset Stuck Jobs
```bash
curl -X POST http://localhost:8080/api/cron/reset-stuck-jobs \
  -H "Content-Type: application/json" \
  -d '{"timeoutMinutes": 5}'
```

## ⚙️ Configuration Options

### Basic Configuration
```typescript
const processor = new CronProcessor({
  batchSize: 20,              // Jobs per batch
  maxConcurrentJobs: 10,      // Global limit
  timeoutSeconds: 120,        // Job timeout
  enableSlackAlerts: true     // Failure notifications
});
```

### Production Configuration
```typescript
const processor = new CronProcessor({
  batchSize: 50,
  maxConcurrentJobs: 25,
  timeoutSeconds: 180,
  heartbeatIntervalMs: 30000,
  stuckJobTimeoutMinutes: 5,
  enableSlackAlerts: true,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL
});
```

## 🔧 External Cron Integration

### Using Supabase Edge Functions
```typescript
// Create a Supabase Edge Function that calls:
const response = await fetch('https://your-api.com/api/cron/webhook', {
  method: 'POST',
  headers: {
    'X-Webhook-Secret': 'your-secret'
  }
});
```

### Using External Cron Services
```bash
# Add to cron-job.org, Railway Cron, or similar
# URL: https://your-api.com/api/cron/webhook
# Method: POST
# Headers: X-Webhook-Secret: your-secret
# Schedule: */5 * * * *  (every 5 minutes)
```

## 📈 Scaling Recommendations

### Small Scale (< 100 jobs/day)
```typescript
{
  batchSize: 10,
  maxConcurrentJobs: 5,
  timeoutSeconds: 60
}
```

### Medium Scale (< 1000 jobs/day)  
```typescript
{
  batchSize: 20,
  maxConcurrentJobs: 10,
  timeoutSeconds: 120
}
```

### Large Scale (1000+ jobs/day)
```typescript
{
  batchSize: 50,
  maxConcurrentJobs: 25,
  timeoutSeconds: 180
}
```

## 🛠️ Troubleshooting

### Jobs Not Processing
```bash
# Check if processor is running
curl http://localhost:8080/api/cron/status

# Check job queue
curl http://localhost:8080/api/cron/queue

# Reset stuck jobs
curl -X POST http://localhost:8080/api/cron/reset-stuck-jobs
```

### High Failure Rates
```bash
# Check error patterns
curl "http://localhost:8080/api/cron/metrics?outcome=failed"

# Get performance insights
curl http://localhost:8080/api/cron/insights
```

### Memory Issues
- Reduce `batchSize` and `maxConcurrentJobs`
- Increase `timeoutSeconds` for complex jobs
- Monitor with `GET /api/cron/queue`

## 📊 Key Benefits Achieved

1. **No More Duplicate Jobs** - Concurrency locks prevent race conditions
2. **Automatic Scaling** - Configurable batch sizes and limits
3. **Production Ready** - Error handling, retries, monitoring
4. **Zero Downtime** - Graceful shutdown and startup
5. **Full Visibility** - Comprehensive logging and analytics
6. **Admin Control** - REST API for all operations

## 🎉 Success Metrics to Track

Monitor your system's performance:

- **Throughput**: Jobs processed per hour
- **Success Rate**: % of successful executions  
- **Latency**: Average job execution time
- **Queue Health**: Pending vs processing jobs
- **Error Patterns**: Most common failure types

## 🔗 Next Steps

1. **Apply the migration** to set up the database schema
2. **Start the processor** manually or via API
3. **Test with your existing jobs** to verify functionality
4. **Set up monitoring** using the health endpoints
5. **Configure alerts** via Slack or your monitoring system
6. **Scale as needed** based on your job volume

---

## 🆘 Need Help?

- Check the comprehensive [README.md](./services/puppet/README.md)
- Run the test suite: `npx ts-node scripts/testCronProcessor.ts`
- Monitor health: `curl http://localhost:8080/api/cron/health`
- View logs in your application for detailed debugging

**Your automated job processing system is ready to handle thousands of jobs per day! 🚀** 