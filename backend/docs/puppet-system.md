# Puppet LinkedIn Automation System

## Overview

Puppet is a production-grade LinkedIn connection request automation system built for HirePilot. It provides safe, controlled LinkedIn automation with comprehensive security detection, rate limiting, and monitoring capabilities.

## ✅ Prompts 1, 2, 3, 4, 5, 6 & 7 Implementation Complete

### What's Been Built

**Prompt 1 - Security Detection & Alerts:**

1. **CAPTCHA & Security Detection System**
   - Detects 6 types of security challenges: CAPTCHA, phone verification, security checkpoints, account restrictions, suspicious activity, and login challenges
   - Multi-selector approach with fallback detection
   - Confidence scoring and element tracking

2. **Screenshot Capture & Storage**
   - Full-page screenshots on security detection
   - Automatic upload to Supabase storage
   - Screenshot metadata tracking with file size, page URL, and user agent
   - Organized file naming with timestamps

3. **Slack Webhook Integration**
   - Rich Block Kit formatted notifications
   - Per-user webhook configuration
   - Event-based notification filtering
   - Includes screenshots, job details, and metadata
   - Auto-pause user automation on security warnings

4. **Job Status Management**
   - Automatic job status updates to 'warning' on detection
   - Database tracking of detection types and error messages
   - Comprehensive execution logging

**Prompt 2 - Core Puppeteer Bot:**

1. **LinkedIn Connection Bot Core Script**
   - Production-grade TypeScript Puppeteer automation
   - Real Chrome browser with full proxy support
   - LinkedIn `li_at` cookie authentication
   - Human behavior simulation (scrolling, delays, mouse movement)
   - Comprehensive edge case handling

2. **Advanced Connection Management**
   - Detects already connected profiles (1st degree connections)
   - Handles pending invitations gracefully
   - Manages "out of invitations" scenarios
   - Custom message support with human-like typing
   - Multiple selector strategies for reliability

3. **Robust Error Handling**
   - CAPTCHA and security checkpoint detection
   - Profile not found scenarios
   - Connect button detection with fallbacks
   - Screenshot capture for debugging
   - Detailed JSON response structure

4. **Production Features**
   - Command line interface with argument parsing
   - Environment variable configuration
   - Proxy authentication support
   - Database logging integration
   - Modular design for easy integration

**Prompt 3 - Residential Proxy Integration:**

1. **Enhanced Proxy Parameter Structure**
   - Support for BrightData and SmartProxy endpoints
   - Residential and datacenter proxy types
   - Location-aware proxy configuration
   - Structured endpoint format (e.g., `us-ny.residential.smartproxy.com:10000`)

2. **IP Verification System**
   - Pre-navigation IP verification via ipify.org JSON API
   - Response time measurement for proxy performance
   - Location verification and logging
   - Comprehensive error handling and fallbacks

3. **Advanced Proxy Authentication**
   - Username/password authentication for residential proxies
   - Enhanced browser launch configuration
   - Proxy-specific user agent handling
   - Authentication setup before page navigation

4. **Proxy Provider Support**
   - **SmartProxy Integration**: Residential and datacenter endpoints
   - **BrightData Integration**: Rotating residential proxy support
   - Flexible configuration for additional proxy providers
   - Location-specific proxy routing

5. **Enhanced Logging & Metadata**
   - Verified IP address tracking in job results
   - Proxy endpoint logging for audit trails
   - Response time metrics for proxy performance
   - Detailed proxy configuration in execution logs

**Prompt 4 - Human Behavior Simulation & Rate Limiting:**

1. **Advanced Human Behavior Simulation**
   - Random scrolling patterns (500px-3000px range)
   - Pre-action mouse hovering with realistic delays (1-3 seconds)
   - Randomized action delays (2-6 seconds before every action)
   - Intelligent profile exploration (70% chance to click About/Experience)
   - Multi-stage scrolling behavior for natural movement

2. **Comprehensive Rate Limiting System**
   - Daily connection limits enforced (20 max/day/user default)
   - Pre-execution rate limit validation
   - Real-time tracking in Supabase (`puppet_daily_stats`)
   - Automatic job rejection when limits exceeded
   - User-configurable daily limits via `puppet_user_settings`

3. **Enhanced Security Detection Points**
   - Pre-behavior security scanning
   - Post-behavior security validation
   - Connection flow security monitoring
   - Immediate job termination on any detection
   - Multiple CAPTCHA/security checkpoint detection methods

4. **Database Integration & Tracking**
   - Automatic successful connection tracking
   - Daily statistics updates (`connections_sent`, `jobs_completed`)
   - Rate limit enforcement integration
   - Security event logging and monitoring
   - User-specific configuration management

5. **Production Safety Features**
   - Multiple security detection checkpoints
   - Enhanced Connect button interaction with hover
   - Natural human-like timing patterns
   - Fail-safe mechanisms for rate limit enforcement
   - Comprehensive error handling and job status management

**Prompt 5 - Railway CRON Job Runner:**

1. **Production-Ready Job Queue Processor**
   - Queries Supabase for pending `puppet_jobs` with `status='pending'` and `scheduled_at <= now()`
   - Processes jobs using `connectToLinkedInProfile()` with database inputs
   - Updates job statuses: `pending -> running -> completed/failed/warning`
   - Logs complete execution details and increments attempt counter (`retry_count++`)

2. **Concurrency Control & Limits**
   - Enforces 1 job per user concurrency limit (no overlapping jobs per user)
   - Limits total jobs per CRON run to 10 for system stability
   - Adds 1-second safety delays between job launches to protect queue
   - Filters jobs intelligently to respect user-level concurrency

3. **Railway Cloud Deployment Ready**
   - Standalone TypeScript script deployable to Railway
   - Environment-based configuration (SUPABASE_URL, SERVICE_ROLE_KEY)
   - CRON schedule integration (0 */5 * * * = every 5 minutes)
   - Graceful shutdown handling (SIGTERM/SIGINT)
   - Comprehensive health checks and error recovery

4. **Enterprise-Grade Error Handling**
   - Job execution timeouts (2 minutes per job)
   - Database connection resilience
   - Failed job recovery and continuation
   - Resource cleanup on errors
   - Detailed logging with execution metrics

5. **Monitoring & Observability**
   - Real-time job status tracking in Supabase
   - Daily statistics updates (`puppet_daily_stats`)
   - Performance metrics and execution timing
   - Error logging with screenshot capture
   - Railway deployment logs integration

**Prompt 6 - REX Auto/Manual Toggle Integration:**

1. **LinkedIn Request Modal Backend Logic**
   - "Send LinkedIn Request" modal API endpoint for lead drawer integration
   - Auto/Manual mode decision logic based on user settings
   - Automation consent validation before job processing
   - Real-time daily limit checking and enforcement
   - Complete activity logging for audit trails

2. **REX Auto Mode (Immediate Queuing)**
   - When Auto Mode is ON: Jobs queued immediately to `puppet_jobs` table
   - Shows confirmation toast with job ID and activity log links
   - Updates daily statistics and remaining connection count
   - Logs auto-queue activity with full job context

3. **REX Manual Mode (Review Required)**
   - When Auto Mode is OFF: Shows drafted message for manual review
   - User sees LinkedIn profile details and generated message
   - Manual approval creates job after user confirmation
   - Tracks manual review timestamps and user interactions

4. **Automation Consent Management**
   - Required consent checkbox: "I consent to HirePilot acting on my behalf..."
   - Consent stored securely in Supabase with timestamp
   - Auto mode automatically disabled when consent is revoked
   - Complete consent history tracking in activity log

5. **Enterprise Integration APIs**
   - RESTful endpoints for frontend modal integration
   - User settings management (consent, auto mode toggle)
   - Activity log retrieval with pagination
   - Error handling with detailed status responses

**Prompt 7 - Super Admin Dashboard (Puppet Monitor):**

1. **Job Table & Monitoring**
   - Comprehensive job table with columns: User, Profile URL, Status, Last Run, Proxy IP, Attempts
   - Advanced filtering: status, date range, user email, proxy location, detection type
   - Real-time pagination and sorting capabilities
   - Admin-specific views for paused/modified jobs

2. **Job Viewer & Controls**
   - Detailed job information with execution logs and input/output data
   - Job action buttons: Retry job, Kill job, Pause job, Add admin notes
   - Admin action history tracking for each job
   - Screenshot and error log visualization for debugging

3. **Comprehensive Statistics**
   - Invites sent today/week per user with success rates
   - Proxy pool usage and health monitoring
   - CAPTCHA/security error trends and incident tracking
   - System-wide performance metrics and user analytics

4. **Emergency Kill Switch**
   - System-wide emergency shutdown with immediate effect
   - `puppet_shutdown_mode` flag in Supabase stops all job runners
   - Maintenance mode with scheduled downtime support
   - Reversible controls with full audit trails

5. **User & Proxy Management**
   - User performance monitoring and administrative controls
   - Bulk operations: pause users, kill jobs, retry failed jobs
   - Proxy pool status tracking and manual assignment
   - Complete admin activity logging with role-based access

## Architecture

### Database Schema

```sql
-- Core Tables Created:
- puppet_jobs              -- Main job queue
- puppet_user_settings     -- Per-user configuration
- puppet_proxies          -- Proxy pool management  
- puppet_job_logs         -- Detailed execution logs
- puppet_daily_stats      -- Rate limiting & reporting
- puppet_screenshots      -- Security detection screenshots

-- Security Features:
- pgcrypto encryption for LinkedIn cookies
- Row Level Security (RLS) policies
- Rate limiting with daily counters
- Audit trails and comprehensive logging
```

### Core Components

#### 1. PuppetLinkedInAutomation Class
**Location:** `backend/services/puppet/puppetAutomation.ts`

Main automation engine with:
- Puppeteer browser management with proxy support
- Security detection scanning with 20+ selectors
- Human-like behavior simulation
- Screenshot capture and upload
- Slack notification system
- Comprehensive error handling

#### 2. Security Detection System

**Detection Types:**
- `captcha` - CAPTCHA challenges
- `phone_verification` - Phone number requests
- `security_checkpoint` - Identity verification
- `account_restriction` - Account limitations
- `suspicious_activity` - Activity warnings
- `login_challenge` - 2FA/email verification

**Detection Process:**
1. Scan page for security elements using CSS selectors
2. Verify element visibility
3. Capture full-page screenshot
4. Upload to Supabase storage
5. Log detection details
6. Send Slack notification
7. Update job status to 'warning'
8. Auto-pause user if configured

#### 3. Job Processing API
**Location:** `backend/api/puppet/processJobs.ts`

Endpoints:
- `POST /api/puppet/process` - Process pending jobs (Railway cron)
- `POST /api/puppet/queue` - Queue new job (manual/testing)

Features:
- Rate limiting checks (20/day default)
- Sequential job processing with delays
- Comprehensive error handling
- Daily statistics tracking
- Auto-retry logic with backoff

#### 4. Slack Notification System

**Rich Notifications Include:**
- Job ID and User ID
- Security detection type
- Screenshot images
- Page URL and metadata
- Timestamp and execution details

**User Configuration:**
- Per-user webhook URLs
- Event filtering (warnings, failures, etc.)
- Auto-pause on security detection

## Safety Controls

### 1. Rate Limiting
- **Default:** 20 connections per day per user
- **Range:** 1-50 connections (configurable)
- **Enforcement:** Checked before job execution
- **Tracking:** Daily statistics with rollover

### 2. Security Detection
- **Real-time scanning** for 6 security challenge types
- **Immediate job termination** on detection
- **Auto-pause automation** if configured
- **Screenshot evidence** for debugging

### 3. Human Behavior Simulation
- Random scroll and mouse movements
- Variable delays between actions
- Realistic typing patterns
- Pause patterns and timing

### 4. Proxy Support
- Residential proxy integration
- One proxy per user (ideally)
- Health checking and rotation
- SmartProxy/BrightData compatible

## Configuration

### Environment Variables Required

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Cookie Encryption
COOKIE_ENCRYPTION_KEY=your_encryption_key

# Proxy (Optional)
PROXY_ENDPOINT=proxy.example.com
PROXY_PORT=8080
PROXY_USERNAME=username
PROXY_PASSWORD=password
```

### User Settings

Each user configures:
- LinkedIn `li_at` cookie (encrypted)
- Daily connection limit (1-50)
- Automation delays (30-300 seconds)
- Security detection preferences
- Slack webhook URL
- Auto-pause on warnings

## Testing

### Test Script
**Location:** `backend/scripts/testPuppetSystem.ts`

Run comprehensive tests:
```bash
cd backend
npm run test:puppet
# or
ts-node scripts/testPuppetSystem.ts
```

**Tests Include:**
- Database schema validation
- User settings management
- Job queue functionality
- Security detection simulation
- Slack notification testing
- Rate limiting validation

### LinkedIn Bot Test
**Location:** `backend/scripts/testLinkedInConnection.ts`

Test LinkedIn connection functionality:
```bash
cd backend
npm run test:linkedin
# or
ts-node scripts/testLinkedInConnection.ts
```

### Proxy Integration Test
**Location:** `backend/scripts/testProxyIntegration.ts`

Test residential proxy integration with IP verification:
```bash
cd backend
TEST_MODE=true npm run test:proxy
# or
TEST_MODE=true ts-node scripts/testProxyIntegration.ts
```

**Proxy Tests Include:**
- SmartProxy residential and datacenter configurations
- BrightData rotating residential proxy testing
- IP verification via ipify.org
- Response time measurement
- Error handling and fallback scenarios
- Direct connection (no proxy) testing

### Human Behavior Test
**Location:** `backend/scripts/testHumanBehavior.ts`

Test advanced human behavior simulation and rate limiting:
```bash
cd backend
TEST_MODE=true npm run test:behavior
# or
TEST_MODE=true ts-node scripts/testHumanBehavior.ts
```

**Human Behavior Tests Include:**
- Random scrolling simulation (500-3000px)
- Profile exploration behavior (About/Experience sections)
- Pre-action hovering and realistic delays
- Daily rate limit enforcement testing
- Security detection checkpoint validation
- Database tracking and statistics updates

### CRON Job Runner Test
**Location:** `backend/scripts/testCronJobRunner.ts`

Test Railway CRON job runner functionality:
```bash
cd backend
TEST_MODE=true npm run test:cron
# or
TEST_MODE=true ts-node scripts/testCronJobRunner.ts
```

**CRON Job Tests Include:**
- Job queue processing simulation
- Concurrency limits enforcement (1 job per user)
- Job limits validation (10 max per run)
- Status transition testing (pending->running->completed)
- Error handling and recovery scenarios
- Railway deployment configuration validation

### REX Integration Test
**Location:** `backend/scripts/testRexIntegration.ts`

Test REX Auto/Manual toggle integration:
```bash
cd backend
TEST_MODE=true npm run test:rex
# or
TEST_MODE=true ts-node scripts/testRexIntegration.ts
```

**REX Integration Tests Include:**
- Automation consent granting/revoking workflow
- REX Auto Mode enable/disable functionality
- Manual mode workflow with message review
- Auto mode workflow with immediate queuing
- Modal decision logic based on user settings
- Complete activity logging and tracking

### Admin Dashboard Test
**Location:** `backend/scripts/testAdminDashboard.ts`

Test Super Admin Dashboard (Puppet Monitor):
```bash
cd backend
TEST_MODE=true npm run test:admin
# or
TEST_MODE=true ts-node scripts/testAdminDashboard.ts
```

**Admin Dashboard Tests Include:**
- Dashboard statistics and performance metrics
- Job table filtering and pagination
- Detailed job viewer with logs and admin actions
- Job control actions (retry, kill, pause, add notes)
- User management (pause, unpause, reset limits, assign proxy)
- Bulk operations on multiple jobs and users
- Emergency controls and kill switch functionality
- Proxy pool monitoring and health tracking
- Complete admin activity logging and audit trails

## API Reference

### Queue Job
```http
POST /api/puppet/queue
Content-Type: application/json

{
  "user_id": "uuid",
  "linkedin_profile_url": "https://linkedin.com/in/profile",
  "message": "Optional connection message",
  "priority": 5,
  "scheduled_at": "2024-01-30T10:00:00Z"
}
```

### Process Jobs (Railway Cron)
```http
POST /api/puppet/process
```

Returns processing statistics and job results.

## Security Features

### 1. Data Protection
- LinkedIn cookies encrypted with pgcrypto
- User-specific encryption keys
- Secure screenshot storage
- RLS policies for data isolation

### 2. Detection Capabilities
- **20+ CSS selectors** for security challenges
- **Multiple detection methods** with fallbacks
- **Visual confirmation** via element visibility
- **Screenshot evidence** for manual review

### 3. Rate Limiting
- **Daily limits** per user (1-50 connections)
- **Real-time tracking** in database
- **Automatic enforcement** before job execution
- **Statistics and reporting** for monitoring

### 4. Auto-Pause System
- **Immediate automation stop** on security detection
- **User-configurable** pause behavior
- **Slack notifications** for manual intervention
- **Resume requires manual action**

## File Structure

```
backend/
├── types/puppet.ts                    # TypeScript interfaces
├── services/puppet/
│   ├── puppetAutomation.ts          # Core automation engine (Prompt 1)
│   └── connectToLinkedInProfile.ts  # LinkedIn connection bot (Prompt 2)
├── api/
│   ├── puppet/
│   │   └── processJobs.ts           # Job processing API
│   ├── rex/
│   │   ├── linkedinRequest.ts       # Prompt 6 LinkedIn request modal API
│   │   └── consentManagement.ts     # Prompt 6 consent & auto mode APIs
│   └── admin/
│       ├── puppetMonitor.ts         # Prompt 7 admin dashboard & monitoring API
│       └── puppetControls.ts        # Prompt 7 job/user controls & emergency API
├── routes/
│   ├── rex.ts                       # REX API router configuration
│   └── admin.ts                     # Admin dashboard API router configuration
├── scripts/
│   ├── testPuppetSystem.ts          # Prompt 1 test suite
│   ├── testLinkedInConnection.ts    # Prompt 2 test suite
│   ├── testProxyIntegration.ts      # Prompt 3 proxy test suite
│   ├── testHumanBehavior.ts         # Prompt 4 human behavior test suite
│   ├── cronJobRunner.ts             # Prompt 5 Railway CRON job runner
│   ├── testCronJobRunner.ts         # Prompt 5 CRON job test suite
│   ├── testRexIntegration.ts        # Prompt 6 REX integration test suite
│   └── testAdminDashboard.ts        # Prompt 7 admin dashboard test suite
├── docs/
│   └── puppet-system.md             # This documentation
└── supabase/migrations/
    ├── 20250130000000_create_puppet_system.sql
    ├── 20250130000001_add_rex_integration.sql
    └── 20250130000002_add_admin_controls.sql
```

## Next Steps

### Upcoming Prompts (2-8)
- Enhanced proxy health monitoring
- CAPTCHA screenshot analysis
- Advanced retry logic with exponential backoff
- Super Admin UI components
- REX Auto Mode integration
- Proxy rotation and health checks
- Advanced error handling and recovery

### Production Deployment
1. Run database migration
2. Install dependencies (`npm install`)
3. Configure environment variables
4. Set up Railway cron job
5. Create Supabase storage bucket: `puppet-screenshots`
6. Configure user Slack webhooks

## Support

For issues or questions about the Puppet system:
1. Check logs in `puppet_job_logs` table
2. Review screenshots in `puppet_screenshots` 
3. Monitor daily stats in `puppet_daily_stats`
4. Test with `scripts/testPuppetSystem.ts`

---

**Status:** ✅ Prompts 1 & 2 Complete  
**Next:** Awaiting Prompt 3 requirements  
**Version:** 2.0.0  
**Last Updated:** January 30, 2025 