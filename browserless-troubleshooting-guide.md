# Browserless LinkedIn Automation Troubleshooting Guide

## Environment Variables Check

Ensure these are set in Railway:
```bash
BROWSERLESS_TOKEN=your-actual-token
BROWSERLESS_URL=https://production-sfo.browserless.io  # No trailing slash
N8N_LINKEDIN_CONNECT_WEBHOOK_URL=your-n8n-webhook-url
```

## Common 400/404 Error Causes & Solutions

### 1. Token Issues
- **400 Bad Request**: Invalid token format
- **401 Unauthorized**: Expired or incorrect token
- **403 Forbidden**: Token lacks required permissions

**Test your token:**
```bash
curl -X GET "https://production-sfo.browserless.io/meta?token=YOUR_TOKEN"
```

### 2. Endpoint Issues (FIXED)
- ❌ OLD: `/function` (generic, v1 behavior)
- ✅ NEW: `/chromium/function` (Playwright-specific, v2)

### 3. Payload Issues

**Check your Browserless plan supports:**
- `/chromium/function` endpoint
- Playwright scripts
- Residential proxies (if using `proxy=residential`)

### 4. Railway Proxy Settings

Railway should NOT interfere, but verify:
```javascript
// In your n8n HTTP Request node
{
  "timeout": 60000,
  "headers": {
    "Content-Type": "application/json",
    "User-Agent": "n8n-webhook/1.0"
  }
}
```

### 5. Script Syntax (FIXED)

Updated from:
```javascript
code: `async ({ page, context }) => { ... }`
```

To:
```javascript
code: `export default async ({ page, context }) => { ... }`
```

## Testing Commands

### 1. Test Browserless API Health
```bash
curl "https://production-sfo.browserless.io/meta?token=YOUR_TOKEN"
```

### 2. Test Function Endpoint
```bash
curl -X POST "https://production-sfo.browserless.io/chromium/function?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "export default async ({ page }) => { return await page.evaluate(() => document.title); }",
    "context": {}
  }'
```

### 3. Test from Railway Environment
```bash
# SSH into Railway container and test connectivity
curl -v "https://production-sfo.browserless.io/meta?token=$BROWSERLESS_TOKEN"
```

## N8N Workflow Configuration

Ensure your n8n HTTP Request node uses:

**URL:** `https://production-sfo.browserless.io/chromium/function?token={{YOUR_TOKEN}}`

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "code": "export default async ({ page, context }) => { /* your LinkedIn automation script */ }",
  "context": {
    "profileUrl": "{{$json.profileUrl}}",
    "message": "{{$json.message}}",
    "cookies": "{{$json.cookies}}",
    "userAgent": "{{$json.userAgent}}"
  }
}
```

## Success Indicators

✅ **Working Setup:**
- No 400/404 errors
- Browserless responds with execution results
- LinkedIn connections are sent successfully

❌ **Still Broken:**
- Persistent 400/404 errors
- "Function not found" messages  
- Timeout errors (check Browserless plan limits)

## Plan-Specific Features

| Feature | Free | Starter | Scale | Enterprise |
|---------|------|---------|-------|------------|
| `/function` endpoint | ✅ | ✅ | ✅ | ✅ |
| `/chromium/function` | ✅ | ✅ | ✅ | ✅ |
| Residential proxies | ❌ | ❌ | ✅ | ✅ |
| Stealth endpoints | ❌ | ❌ | ✅ | ✅ |
| Extended timeouts | ❌ | Limited | ✅ | ✅ |

## Next Steps

1. Test the updated `/chromium/function` endpoint
2. Verify your Browserless plan supports required features
3. Check Railway environment variables
4. Test n8n webhook with new endpoint
5. Monitor success rates and error patterns