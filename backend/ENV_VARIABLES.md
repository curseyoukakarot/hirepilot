# Required Environment Variables for HirePilot LinkedIn Outreach

## 🗄️ Database Configuration
```
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 🌐 Server Configuration
```
PORT=8080
NODE_ENV=development
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📦 PhantomBuster + LinkedIn Automation
```
PHANTOMBUSTER_API_KEY=your_phantombuster_api_key_here
PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID=your_phantom_id_here
```
> **Note**: LinkedIn session cookies are stored per-user in the `linkedin_cookies` database table (encrypted), not as global environment variables. Users provide their cookies via the browser extension or settings page.

## 🔁 Zapier Webhooks
```
ZAPIER_LINKEDIN_WEBHOOK_URL2=https://hooks.zapier.com/hooks/catch/18279230/u2qdg1l/
ZAPIER_PHANTOM_WEBHOOK_URL=your_zapier_phantom_webhook_url_here
ZAPIER_WEBHOOK_BASE=https://hooks.zapier.com/hooks/catch/
```

## 🤖 OpenAI Configuration
```
OPENAI_API_KEY=your_openai_api_key_here
```

## 📧 Email Configuration (SendGrid)
```
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

## 📧 SMTP Configuration (Alternative)
```
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@yourdomain.com
```

## 🚀 Apollo Integration
```
APOLLO_CLIENT_ID=your_apollo_client_id_here
APOLLO_CLIENT_SECRET=your_apollo_client_secret_here
APOLLO_AUTH_URL=https://developer.apollo.io/oauth/authorize
HIREPILOT_APOLLO_API_KEY=your_apollo_api_key_here
SUPER_ADMIN_APOLLO_API_KEY=your_super_admin_apollo_key_here
```

## 📧 Google OAuth (Gmail)
```
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

## 📧 Outlook OAuth
```
OUTLOOK_CLIENT_ID=your_outlook_client_id_here
OUTLOOK_CLIENT_SECRET=your_outlook_client_secret_here
```

## 💳 Stripe Configuration
```
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
```

## 🔍 Data Enrichment Services
```
PROXYCURL_API_KEY=your_proxycurl_api_key_here
NEVERBOUNCE_API_KEY=your_neverbounce_api_key_here
```

## 🌐 Bright Data Web Unlocker & Scraper (Optional)
```
BRIGHTDATA_ENABLED=true                           # Toggle without redeploying
BRIGHTDATA_API_TOKEN=bd_xxxxxxxxxxxxxxxxxxxxxxxxx
BRIGHTDATA_LINKEDIN_PROFILE_SCRAPER_ID=cllxxxxxxxxprofile
BRIGHTDATA_LINKEDIN_COMPANY_SCRAPER_ID=cllxxxxxxxxcompany
BRIGHTDATA_LINKEDIN_JOBS_SCRAPER_ID=cllxxxxxxxxjobs          # Optional but recommended
BRIGHTDATA_GENERIC_JOB_SCRAPER_ID=cllxxxxxxxxgeneric         # Optional for non-LI boards

# Unlocker (raw HTTP) configuration
BRIGHTDATA_UNLOCKER_ZONE=web_unlocker_shared      # Zone/port you created in Bright Data
BRIGHTDATA_UNLOCKER_ENDPOINT=https://unblock.brightdata.com/api/v1/requests   # Optional override

# Polling / timeout tuning (optional)
BRIGHTDATA_SCRAPER_TRIGGER_URL=https://api.brightdata.com/dca/trigger
BRIGHTDATA_SCRAPER_RESULTS_URL=https://api.brightdata.com/dca/get_result
BRIGHTDATA_MAX_POLL_MS=180000                     # default 3 minutes
BRIGHTDATA_POLL_INTERVAL_MS=4000                  # default 4 seconds
```
> Leave these blank to disable Bright Data. All integrations are feature-flagged and will fall back to existing providers automatically.

### Bright Data Browser API (Optional)
```
BRIGHTDATA_BROWSER_ENABLED=false                  # Optional flag to toggle remote LinkedIn actions
BRIGHTDATA_BROWSER_API_TOKEN=bd_browser_xxxxxxxxxxxxxxxxx
BRIGHTDATA_BROWSER_BASE_URL=https://brd.superproxy.io/browser/...
BRIGHTDATA_BROWSER_COUNTRY=us
BRIGHTDATA_BROWSER_MAX_CONCURRENCY=5

# Allow the admin test harness endpoint in production (default false)
ALLOW_REMOTE_ACTION_TESTS=false
```
> Leave these unset to keep remote LinkedIn actions disabled. The Browser API uses user cookies, is gated by plan settings, and consumes remote-action credits.

## 🔴 Redis Configuration (Required for AI Agents)
```
REDIS_URL=redis://default:<password>@<host>:<port>
```

## 🤖 AI Agents Configuration
```
FRONTEND_BASE_URL=https://app.yourdomain.com
BACKEND_BASE_URL=https://api.yourdomain.com
AGENTS_API_TOKEN=<short-lived JWT for REX to call API>
APOLLO_API_BASE=https://api.apollo.io/v1
```

## 💬 Slack Integration (Required for Sourcing Agent)
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
REX_WEBHOOK_URL=https://rex.yourdomain.com/hooks/agent-interaction
SLACK_DEFAULT_CHANNEL=#sourcing-alerts  # Optional: default channel for notifications
```

## 🔐 Security
```
COOKIE_ENCRYPTION_KEY=your_32_byte_encryption_key_here_123456
```

## 🚀 Deployment Notes

### For Railway/Vercel:
1. Add all these variables to your environment settings
2. Replace placeholder values with actual API keys
3. Set `NODE_ENV=production` for production deployments
4. Update `BACKEND_URL` and `FRONTEND_URL` to match your deployed URLs

### Railway Worker Service (recommended)
Remote LinkedIn actions run via BullMQ on Redis. In production, this is most reliable as a **separate Railway service** that runs only the worker process.

- **Create a second Railway service** pointing to the same repo (e.g. `hirepilot-worker`)
- **Use the same repo root** and ensure Railway is building with `backend/Dockerfile` (repo-root build context)
- **Copy backend env vars** needed for DB + Redis + Bright Data Browser
- **Set Start Command (ts-node runtime)** (recommended for current Dockerfile / fastest to unblock):

```
TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register src/workers/linkedinRemoteAction.worker.ts
```

If you later add a build step that outputs `dist/`, you can switch to:

```
node dist/src/workers/linkedinRemoteAction.worker.js
```

Minimum envs the worker needs:
- `REDIS_URL` (or `REDIS_TLS_URL`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `COOKIE_ENCRYPTION_KEY`
- `BRIGHTDATA_BROWSER_ENABLED=true`
- `BRIGHTDATA_BROWSER_API_TOKEN`, `BRIGHTDATA_BROWSER_BASE_URL` (and optional `BRIGHTDATA_BROWSER_COUNTRY`, `BRIGHTDATA_BROWSER_MAX_CONCURRENCY`)


### LinkedIn Cookie Management:
- **No global LinkedIn cookie needed** - each user stores their own encrypted cookie
- Users provide cookies via:
  1. **Browser Extension**: Automatically grabs `li_at` cookie from LinkedIn
  2. **Settings Page**: Manual paste of session cookie
- Cookies are encrypted with `COOKIE_ENCRYPTION_KEY` before storage
- CRON job fetches user-specific cookies for LinkedIn requests

### PhantomBuster Integration:
1. Create PhantomBuster account and get API key
2. Set up LinkedIn connection request phantom/agent
3. Get the phantom ID for `PHANTOMBUSTER_LINKEDIN_SEARCH_PHANTOM_ID`
4. Configure Zapier webhook to trigger phantom with user cookies 