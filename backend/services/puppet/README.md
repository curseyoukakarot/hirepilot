# Puppet Cron Processor System

A comprehensive automated job processing system for handling puppet jobs with concurrency control, batch processing, timeout management, and detailed analytics.

## 🎯 Overview

The Cron Processor system provides:

- **Automated Batch Processing**: Processes pending jobs in configurable batches
- **Concurrency Control**: Prevents duplicate processing and enforces per-user limits  
- **Timeout Management**: Automatically handles stuck and long-running jobs
- **Execution Tracking**: Comprehensive logging and analytics
- **Error Recovery**: Retry integration and failure handling
- **Real-time Monitoring**: Health checks and performance metrics
- **Slack Alerts**: Optional notifications for failures

## 🏗️ System Architecture

### Core Components

1. **CronProcessor** - Main orchestrator for batch job processing
2. **ConcurrencyManager** - Handles job locks and per-user limits
3. **BatchJobLoader** - Safely fetches and loads pending jobs
4. **JobExecutor** - Wraps job execution with status tracking
5. **ExecutionHistoryService** - Analytics and performance insights

### Database Schema

- `puppet_job_execution_logs` - Detailed execution tracking
- `puppet_cron_processor_state` - Processor coordination and health
- `puppet_job_concurrency_locks` - Concurrency control locks
- Enhanced `puppet_jobs` table with execution fields

## 🚀 Quick Start

### 1. Database Setup

Run the migration to set up the required tables and functions:

```sql
-- Apply the migration
-- supabase/migrations/20250130000011_add_cron_concurrency_system.sql
```

### 2. Environment Configuration

```env
# Required
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
CRON_WEBHOOK_SECRET=your_webhook_secret
SLACK_WEBHOOK_URL=your_slack_webhook_url
ENABLE_SLACK_ALERTS=true
```

### 3. Start the Processor

```typescript
import CronProcessor from './services/puppet/cronProcessor';

const processor = new CronProcessor({
  batchSize: 20,
  maxConcurrentJobs: 10,
  timeoutSeconds: 120,
  enableSlackAlerts: true
});

await processor.start();
```

### 4. Add Routes

```typescript
import cronProcessorRoutes from './routes/cronProcessor';
app.use('/api/cron', cronProcessorRoutes);
```

## 📡 API Reference

### Management Endpoints

#### Start Processor
```
POST /api/cron/start
Content-Type: application/json

{
  "batchSize": 20,
  "maxConcurrentJobs": 10,
  "timeoutSeconds": 120,
  "enableSlackAlerts": true,
  "slackWebhookUrl": "https://hooks.slack.com/..."
}
```

#### Stop Processor
```
POST /api/cron/stop
```

#### Get Status
```
GET /api/cron/status
```

#### Trigger Manual Batch
```
POST /api/cron/trigger
```

### Monitoring Endpoints

#### Health Check
```
GET /api/cron/health
```

#### Job Queue Status
```
GET /api/cron/queue
```

#### Execution Metrics
```
GET /api/cron/metrics?startDate=2024-01-01&endDate=2024-01-31&jobType=linkedin_outreach
```

#### Performance Insights
```
GET /api/cron/insights?startDate=2024-01-01&endDate=2024-01-31
```

### Admin Endpoints

#### Reset Stuck Jobs
```
POST /api/cron/reset-stuck-jobs
Content-Type: application/json

{
  "timeoutMinutes": 5
}
```

#### Update Configuration
```
PUT /api/cron/config
Content-Type: application/json

{
  "batchSize": 25,
  "maxConcurrentJobs": 15,
  "timeoutSeconds": 180
}
```

### Webhook Endpoint

#### External Cron Trigger
```
POST /api/cron/webhook
Headers:
  X-Webhook-Secret: your_webhook_secret

# Or in body:
{
  "secret": "your_webhook_secret"
}
```

## ⚙️ Configuration Options

### CronProcessor Config

```typescript
interface CronProcessorConfig {
  processorId: string;              // Unique processor identifier
  batchSize: number;                // Jobs per batch (default: 20)
  maxConcurrentJobs: number;        // Global concurrency limit (default: 10)
  timeoutSeconds: number;           // Job timeout (default: 120)
  retryAttempts: number;            // Retry attempts (default: 3)
  heartbeatIntervalMs: number;      // Heartbeat frequency (default: 30000)
  stuckJobTimeoutMinutes: number;   // Stuck job reset time (default: 5)
  enableSlackAlerts: boolean;       // Enable Slack notifications (default: false)
  slackWebhookUrl?: string;         // Slack webhook URL
}
```

### Concurrency Settings

- **Global Limit**: Maximum jobs executing across all users
- **Per-User Limit**: Maximum jobs per user (default: 2)
- **Batch Lock**: Prevents duplicate batch processing
- **Job Lock**: Prevents duplicate job execution

## 📊 Monitoring & Analytics

### Real-time Metrics

- Current job queue status
- Executing jobs by processor
- Concurrency statistics
- Error rates and types

### Historical Analytics

- Daily execution trends
- Performance by job type
- User success rates
- Error analysis and patterns
- Peak hour analysis

### Health Monitoring

- Processor health status
- Database connectivity
- Stuck job detection
- Performance recommendations

## 🔄 Integration with Existing System

### Job Creation

Your existing job creation code remains unchanged. The cron processor will automatically pick up jobs with:

```sql
status = 'pending' 
AND scheduled_at <= NOW() 
AND final_status IS NULL
```

### Retry System Integration

The processor integrates with your existing retry system by:

1. Marking failed jobs with `final_status = 'failed'`
2. Setting `next_retry_at` for eligible retries
3. Logging execution attempts and errors

### Invite Deduplication Integration

The processor works seamlessly with the invite deduplication system by:

1. Running deduplication checks before job execution
2. Recording invite attempts and responses
3. Enforcing cooldown periods

## 🚨 Error Handling & Recovery

### Automatic Recovery

- **Stuck Jobs**: Reset jobs executing longer than timeout
- **Failed Batches**: Log errors and continue processing
- **Process Crashes**: Graceful shutdown handlers
- **Database Errors**: Retry with exponential backoff

### Error Types Tracked

- `timeout` - Job exceeded time limit
- `network` - Network connectivity issues
- `authentication` - Auth/permission failures
- `linkedin_error` - LinkedIn-specific errors
- `rate_limit` - Rate limiting issues
- `validation_error` - Invalid job configuration

### Slack Alerts

Automatically sent when:
- Batch failure rate exceeds success rate
- Critical system errors occur
- Processor health deteriorates

## 📈 Performance Optimization

### Recommended Settings

**Small Scale (< 100 jobs/day)**
```typescript
{
  batchSize: 10,
  maxConcurrentJobs: 5,
  timeoutSeconds: 60
}
```

**Medium Scale (< 1000 jobs/day)**
```typescript
{
  batchSize: 20,
  maxConcurrentJobs: 10,
  timeoutSeconds: 120
}
```

**Large Scale (1000+ jobs/day)**
```typescript
{
  batchSize: 50,
  maxConcurrentJobs: 25,
  timeoutSeconds: 180
}
```

### Database Optimization

- Indexes on job status and execution timestamps
- Automatic cleanup of old execution logs
- Periodic VACUUM for performance

### Load Balancing

- Multiple processor instances with unique IDs
- Automatic job distribution
- Heartbeat-based health monitoring

## 🔧 Troubleshooting

### Common Issues

**Jobs Not Processing**
- Check processor is running: `GET /api/cron/status`
- Verify database connectivity
- Check concurrency limits

**High Failure Rates**
- Review error logs: `GET /api/cron/metrics`
- Check job configuration validity
- Verify external service availability

**Stuck Jobs**
- Reset stuck jobs: `POST /api/cron/reset-stuck-jobs`
- Reduce timeout settings
- Check system resources

### Debug Mode

Enable detailed logging:

```typescript
const processor = new CronProcessor({
  enableDebugging: true
});
```

### Health Check

Monitor system health:

```bash
curl -f http://your-api/api/cron/health || echo "System unhealthy"
```

## 🔐 Security Considerations

- Use service role key for database access
- Secure webhook endpoints with secrets
- Implement rate limiting on API endpoints
- Monitor for suspicious job patterns
- Regular security updates

## 📅 Deployment Strategies

### Development
```typescript
// Single processor instance
const processor = new CronProcessor({
  batchSize: 5,
  maxConcurrentJobs: 2
});
```

### Production
```typescript
// Multiple processor instances
const processor = new CronProcessor({
  processorId: `prod-${hostname}-${pid}`,
  batchSize: 25,
  maxConcurrentJobs: 15,
  enableSlackAlerts: true
});
```

### Scaling
- Horizontal: Multiple server instances
- Vertical: Increase batch size and concurrency
- Database: Read replicas for analytics

## 🎉 Success Metrics

Track your system's success with:

- **Throughput**: Jobs processed per hour
- **Success Rate**: Percentage of successful jobs
- **Latency**: Average job execution time
- **Availability**: System uptime percentage
- **Error Rate**: Failed jobs per batch

---

## 📚 Additional Resources

- [Database Schema Reference](./database-schema.md)
- [API Documentation](./api-docs.md)
- [Performance Tuning Guide](./performance-guide.md)
- [Monitoring Setup](./monitoring-setup.md)

## 🤝 Contributing

1. Follow existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Monitor performance impact
5. Ensure backward compatibility 