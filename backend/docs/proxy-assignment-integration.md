# 🌐 Proxy Assignment System Integration Guide

## Overview
The Proxy Assignment System provides dedicated residential proxy management for LinkedIn automation. Each user gets a dedicated proxy that follows them across all their automation jobs.

## Core Features

✅ **Dedicated Proxy per User** - Each user gets assigned a consistent proxy  
✅ **Smart Load Balancing** - Automatically assigns least-loaded proxies  
✅ **Health Monitoring** - Tracks proxy performance and failures  
✅ **Auto-Rotation** - Intelligently rotates failed proxies  
✅ **Performance Tracking** - Monitors success/failure rates  
✅ **Admin Controls** - Full administrative oversight and management  

## Database Schema

### `user_proxy_assignments` Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (FK to auth.users) 
- proxy_id: UUID (FK to proxy_pool)
- active: BOOLEAN (default true)
- assigned_at: TIMESTAMPTZ
- total_jobs_processed: INTEGER
- successful_jobs: INTEGER  
- failed_jobs: INTEGER
```

### Enhanced `proxy_pool` Table
```sql
- in_use: BOOLEAN (default false) -- NEW COLUMN
- max_concurrent_users: INTEGER
- status: ENUM('active', 'inactive', 'maintenance', 'banned', 'testing')
```

## Core Functions

### 1. `assignProxyToUser(userId: string): Promise<string>`

**Main function requested in the prompt** - Assigns or returns existing proxy for user.

```typescript
import { assignProxyToUser } from '../services/puppet/proxyAssignmentService';

// Assign proxy to user (or get existing)
const proxyId = await assignProxyToUser('user-uuid-here');
console.log(`User assigned proxy: ${proxyId}`);
```

**Behavior:**
- ✅ Check if user already has active assignment → return existing proxy ID
- ✅ If not assigned → find best available proxy based on:
  - Active status
  - Available capacity (< max_concurrent_users)
  - Good health metrics (high success rate)
  - Balanced load (fewer current assignments)
- ✅ Mark proxy as `in_use = true`
- ✅ Create assignment record
- ✅ Return proxy ID

### 2. Get Proxy Details for Puppeteer

```typescript
import { ProxyAssignmentService } from '../services/puppet/proxyAssignmentService';

const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);

if (proxyDetails) {
  const puppeteerConfig = ProxyAssignmentService.formatProxyForPuppeteer(proxyDetails);
  
  // Use in Puppeteer launch
  const browser = await puppeteer.launch({
    headless: false,
    args: [`--proxy-server=${puppeteerConfig.server}`]
  });
  
  // Authenticate with proxy
  await page.authenticate({
    username: puppeteerConfig.username,
    password: puppeteerConfig.password
  });
}
```

## Integration with Puppet Jobs

### Enhanced Job Processing

```typescript
import { assignProxyToUser } from '../services/puppet/proxyAssignmentService';
import { ProxyAssignmentService } from '../services/puppet/proxyAssignmentService';

async function processLinkedInJob(jobId: string, userId: string) {
  try {
    // 1. Assign proxy to user
    const proxyId = await assignProxyToUser(userId);
    console.log(`✅ User ${userId} assigned proxy ${proxyId}`);
    
    // 2. Get proxy details for Puppeteer
    const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);
    const puppeteerConfig = ProxyAssignmentService.formatProxyForPuppeteer(proxyDetails);
    
    // 3. Launch browser with proxy
    const browser = await puppeteer.launch({
      headless: false,
      args: [`--proxy-server=${puppeteerConfig.server}`]
    });
    
    const page = await browser.newPage();
    await page.authenticate({
      username: puppeteerConfig.username,
      password: puppeteerConfig.password
    });
    
    // 4. Perform LinkedIn automation...
    const startTime = Date.now();
    const success = await performLinkedInConnection(page, profileUrl, message);
    const responseTime = Date.now() - startTime;
    
    // 5. Update proxy performance
    await ProxyAssignmentService.updateAssignmentPerformance(
      userId, 
      success, 
      responseTime
    );
    
    return success;
    
  } catch (error) {
    // Update performance on failure
    await ProxyAssignmentService.updateAssignmentPerformance(userId, false);
    throw error;
  }
}
```

## API Endpoints

### User Endpoints

```bash
# Get assigned proxy info
GET /api/puppet/proxy/assigned
Authorization: Bearer <token>

# Assign or get proxy
POST /api/puppet/proxy/assign  
Authorization: Bearer <token>

# Get assignment details
GET /api/puppet/proxy/assignment
Authorization: Bearer <token>

# Request proxy reassignment
POST /api/puppet/proxy/reassign
Content-Type: application/json
Authorization: Bearer <token>
{
  "reason": "poor_performance"
}

# Update proxy performance (system use)
POST /api/puppet/proxy/performance
Content-Type: application/json  
Authorization: Bearer <token>
{
  "was_successful": true,
  "response_time_ms": 1200
}
```

### Admin Endpoints

```bash
# Get all user assignments
GET /api/puppet/proxy/admin/assignments
Authorization: Bearer <admin-token>

# Get available proxies  
GET /api/puppet/proxy/admin/available
Authorization: Bearer <admin-token>

# Force assign proxy to user
POST /api/puppet/proxy/admin/force-assign
Content-Type: application/json
Authorization: Bearer <admin-token>
{
  "user_id": "user-uuid",
  "proxy_id": "proxy-uuid", 
  "reason": "manual_assignment"
}
```

## SmartProxy Integration Example

### Setting Up SmartProxy Pool

```sql
-- Insert SmartProxy residential proxies
INSERT INTO proxy_pool (
  provider,
  endpoint, 
  username,
  password,
  country_code,
  region,
  proxy_type,
  max_concurrent_users,
  status
) VALUES 
(
  'smartproxy',
  'us.smartproxy.com:10000',
  'username-cc-us', 
  'your-password',
  'US',
  'North America', 
  'residential',
  3,
  'active'
),
(
  'smartproxy',
  'uk.smartproxy.com:10001',
  'username-cc-uk',
  'your-password', 
  'UK',
  'Europe',
  'residential', 
  2,
  'active'
);
```

### SmartProxy Sticky Sessions

SmartProxy format: `username-cc-{country}:password@endpoint:port`

```typescript
// Automatic country-based assignment
const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);

// For SmartProxy, username includes country code
// Example: username-cc-us, username-cc-uk
console.log(`Using SmartProxy: ${proxyDetails.country_code} region`);
```

## Testing

```bash
# Run the comprehensive test suite
npm run test:proxy-assignment

# Test individual components
npm run test:puppet  # General puppet system
npm run test:proxy   # Proxy health monitoring  
```

## Monitoring & Health

### Available Views

```sql
-- See all active assignments
SELECT * FROM user_proxy_assignments WHERE active = true;

-- Check proxy availability
SELECT * FROM available_proxies_for_assignment;

-- Monitor proxy health
SELECT * FROM proxy_health WHERE status = 'active';
```

### Performance Metrics

```typescript
// Get assignment performance
const assignment = await ProxyAssignmentService.getUserProxyAssignment(userId);
console.log(`Success rate: ${assignment.successful_jobs}/${assignment.total_jobs_processed}`);

// Get all assignments (admin)
const allAssignments = await ProxyAssignmentService.getAllUserAssignments();
console.log(`Total active assignments: ${allAssignments.length}`);
```

## Error Handling & Recovery

### Automatic Proxy Rotation

```typescript
// If proxy fails multiple times, auto-reassign
try {
  await performLinkedInJob(jobId, userId);
} catch (error) {
  if (error.message.includes('proxy_failed')) {
    // Automatically rotate to new proxy
    const newProxyId = await ProxyAssignmentService.reassignUserProxy(
      userId, 
      'failure_recovery'
    );
    console.log(`🔄 Rotated to new proxy: ${newProxyId}`);
    
    // Retry with new proxy
    await performLinkedInJob(jobId, userId);
  }
}
```

## Next Steps: Prompt 2

Ready for **Prompt 2: Proxy Health Rotation Logic** which will add:
- ✅ Automatic bad proxy detection  
- ✅ Health-based rotation triggers
- ✅ Intelligent reassignment algorithms
- ✅ Performance threshold monitoring

---

## Summary

🎯 **Prompt 1 Complete:**
- ✅ `user_proxy_assignments` table created
- ✅ `assignProxyToUser()` function implemented  
- ✅ Smart load balancing with health consideration
- ✅ Complete API endpoints
- ✅ Full Puppeteer integration ready
- ✅ SmartProxy compatibility built-in
- ✅ Comprehensive test suite included

**Ready for production use with 5GB SmartProxy plan!** 🚀 