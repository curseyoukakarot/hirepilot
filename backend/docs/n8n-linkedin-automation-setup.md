# n8n LinkedIn Automation Integration Setup

This document explains how to set up the n8n automation layer for HirePilot's LinkedIn Connect request automation using Browserless.io.

## Overview

The n8n integration provides an external orchestration layer that:
- Receives webhook triggers from HirePilot backend
- Retrieves LinkedIn cookies from Supabase
- Executes LinkedIn actions via Browserless /function API
- Returns success/failure status back to HirePilot

## Prerequisites

1. **n8n Instance**: Running n8n instance (cloud or self-hosted)
2. **Browserless Token**: Active Browserless.io subscription with API token
3. **Environment Variables**: Properly configured HirePilot backend

## Environment Variables Required

Add these to your HirePilot backend environment:

```bash
# n8n Configuration
N8N_LINKEDIN_CONNECT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/linkedin-connect-automation

# Browserless Configuration (already exists)
BROWSERLESS_TOKEN=your_browserless_token_here
BROWSERLESS_URL=https://production-sfo.browserless.io
```

## n8n Workflow Setup

### Step 1: Create New Workflow

1. Log into your n8n instance
2. Create a new workflow
3. Name it "LinkedIn Connect Automation"

### Step 2: Configure Webhook Trigger Node

**Node Type**: Webhook
**Configuration**:
```json
{
  "httpMethod": "POST",
  "path": "linkedin-connect-automation",
  "responseMode": "responseNode",
  "authentication": "none"
}
```

**Expected Webhook Payload**:
```json
{
  "profileUrl": "https://www.linkedin.com/in/example-profile/",
  "message": "Hi! I'd love to connect with you.",
  "user_id": "uuid-of-hirepilot-user",
  "lead_id": "uuid-of-lead-optional",
  "campaign_id": "uuid-of-campaign-optional",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Step 3: Add Supabase Node (Fetch Cookies)

**Node Type**: Supabase
**Configuration**:
```json
{
  "operation": "getRow",
  "table": "linkedin_cookies",
  "filterType": "manual",
  "conditions": {
    "user_id": "={{ $json.user_id }}"
  },
  "columns": [
    "session_cookie",
    "encrypted_cookie", 
    "li_at",
    "jsessionid",
    "user_agent",
    "is_valid",
    "status",
    "expires_at"
  ]
}
```

**Supabase Connection Settings**:
- Host: Your Supabase project URL
- Database: postgres
- User: service_role key (or appropriate user)
- Password: Your service role secret

### Step 4: Add JavaScript Node (Process Cookies)

**Node Type**: Code
**Language**: JavaScript

```javascript
// Format cookies for Browserless
const cookieData = $input.first().json;

// Validate cookie is still valid
if (!cookieData.is_valid || (cookieData.status && cookieData.status !== 'valid')) {
  return [{
    json: {
      error: 'Invalid LinkedIn cookies',
      status: 'error'
    }
  }];
}

// Check expiration
if (cookieData.expires_at) {
  const expiresAt = new Date(cookieData.expires_at);
  if (expiresAt < new Date()) {
    return [{
      json: {
        error: 'Expired LinkedIn cookies',
        status: 'error'
      }
    }];
  }
}

// Format cookies for Browserless
const cookies = [];

// Parse session_cookie if it exists
if (cookieData.session_cookie) {
  const cookieEntries = cookieData.session_cookie.split(';').map(part => part.trim()).filter(Boolean);
  
  for (const entry of cookieEntries) {
    const equalIdx = entry.indexOf('=');
    if (equalIdx === -1) continue;
    
    const name = entry.substring(0, equalIdx).trim();
    let value = entry.substring(equalIdx + 1).trim();
    
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    
    cookies.push({
      name,
      value,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    });
  }
}

// Add individual cookies if available
if (cookieData.li_at) {
  cookies.push({
    name: 'li_at',
    value: cookieData.li_at,
    domain: '.linkedin.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  });
}

if (cookieData.jsessionid) {
  cookies.push({
    name: 'JSESSIONID',
    value: cookieData.jsessionid,
    domain: '.linkedin.com',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax'
  });
}

const webhookData = $('Webhook').first().json;

return [{
  json: {
    profileUrl: webhookData.profileUrl,
    message: webhookData.message,
    cookies: cookies,
    userAgent: cookieData.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    user_id: webhookData.user_id,
    lead_id: webhookData.lead_id,
    campaign_id: webhookData.campaign_id
  }
}];
```

### Step 5: Add HTTP Request Node (Browserless Function)

**Node Type**: HTTP Request
**Configuration**:
```json
{
  "method": "POST",
  "url": "https://production-sfo.browserless.io/function",
  "sendQuery": true,
  "queryParameters": {
    "token": "YOUR_BROWSERLESS_TOKEN"
  },
  "sendHeaders": true,
  "headerParameters": {
    "Content-Type": "application/json"
  },
  "sendBody": true,
  "bodyContentType": "json",
  "jsonBody": {
    "context": {
      "profileUrl": "={{ $json.profileUrl }}",
      "message": "={{ $json.message }}",
      "cookies": "={{ $json.cookies }}",
      "userAgent": "={{ $json.userAgent }}"
    },
    "code": "async ({ page, context }) => {\n  try {\n    // Set user agent\n    await page.setUserAgent(context.userAgent);\n    \n    // Set cookies\n    if (context.cookies && context.cookies.length > 0) {\n      await page.setCookie(...context.cookies);\n      console.log('Set cookies:', context.cookies.length);\n    }\n    \n    // Navigate to profile\n    console.log('Navigating to:', context.profileUrl);\n    await page.goto(context.profileUrl, { \n      waitUntil: 'networkidle2', \n      timeout: 30000 \n    });\n    \n    // Wait for page to load\n    await page.waitForTimeout(2000);\n    \n    // Look for Connect button (various selectors)\n    const connectSelectors = [\n      'button[aria-label*=\"Connect\"]',\n      'button:has-text(\"Connect\")',\n      'button[data-control-name=\"connect\"]',\n      'button.artdeco-button--2:has-text(\"Connect\")'\n    ];\n    \n    let connectButton = null;\n    for (const selector of connectSelectors) {\n      try {\n        connectButton = await page.waitForSelector(selector, { timeout: 5000 });\n        if (connectButton) {\n          console.log('Found connect button with selector:', selector);\n          break;\n        }\n      } catch (e) {\n        console.log('Selector not found:', selector);\n      }\n    }\n    \n    if (!connectButton) {\n      return { \n        status: 'manual_review_needed', \n        error: 'Connect button not found - may already be connected or page structure changed'\n      };\n    }\n    \n    // Click Connect button\n    await connectButton.click();\n    console.log('Clicked Connect button');\n    \n    // Wait for modal to appear\n    await page.waitForTimeout(1500);\n    \n    // Look for message textarea\n    const messageSelectors = [\n      'textarea[name=\"message\"]',\n      'textarea[aria-label*=\"message\"]',\n      '.send-invite__custom-message textarea',\n      '#custom-message'\n    ];\n    \n    let messageField = null;\n    for (const selector of messageSelectors) {\n      try {\n        messageField = await page.waitForSelector(selector, { timeout: 3000 });\n        if (messageField) {\n          console.log('Found message field with selector:', selector);\n          break;\n        }\n      } catch (e) {\n        console.log('Message selector not found:', selector);\n      }\n    }\n    \n    if (messageField && context.message) {\n      // Clear existing text and type message\n      await messageField.click();\n      await page.keyboard.selectAll();\n      await page.type(messageField, context.message);\n      console.log('Typed custom message');\n    }\n    \n    // Look for Send/Send invitation button\n    const sendSelectors = [\n      'button[aria-label*=\"Send invitation\"]',\n      'button[aria-label*=\"Send now\"]',\n      'button:has-text(\"Send invitation\")',\n      'button:has-text(\"Send\")',\n      '.send-invite__actions button[data-control-name=\"send\"]'\n    ];\n    \n    let sendButton = null;\n    for (const selector of sendSelectors) {\n      try {\n        sendButton = await page.waitForSelector(selector, { timeout: 3000 });\n        if (sendButton) {\n          console.log('Found send button with selector:', selector);\n          break;\n        }\n      } catch (e) {\n        console.log('Send selector not found:', selector);\n      }\n    }\n    \n    if (!sendButton) {\n      return { \n        status: 'manual_review_needed', \n        error: 'Send invitation button not found'\n      };\n    }\n    \n    // Click Send button\n    await sendButton.click();\n    console.log('Clicked Send invitation button');\n    \n    // Wait for confirmation\n    await page.waitForTimeout(2000);\n    \n    // Check for success indicators\n    const successSelectors = [\n      '.artdeco-toast-message',\n      '[data-test-id=\"toast-message\"]',\n      '.ip-fuse-toast__message'\n    ];\n    \n    let successFound = false;\n    for (const selector of successSelectors) {\n      try {\n        const element = await page.waitForSelector(selector, { timeout: 2000 });\n        if (element) {\n          const text = await element.textContent();\n          if (text && (text.includes('invitation sent') || text.includes('Invitation sent'))) {\n            successFound = true;\n            console.log('Success confirmation found');\n            break;\n          }\n        }\n      } catch (e) {\n        // Continue to next selector\n      }\n    }\n    \n    return { \n      status: successFound ? 'success' : 'manual_review_needed',\n      message: successFound ? 'Connection request sent successfully' : 'Request may have been sent but confirmation unclear'\n    };\n    \n  } catch (error) {\n    console.error('Browserless function error:', error);\n    return { \n      status: 'error', \n      error: error.message \n    };\n  }\n}"
  },
  "timeout": 60000
}
```

### Step 6: Add Error Handling and Slack Notification (Optional)

**Node Type**: Slack
**Condition**: Only if Browserless function fails
**Configuration**:
```json
{
  "channel": "#hirepilot-alerts",
  "text": "LinkedIn Connect Automation Failed",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*LinkedIn Connect Automation Failed*\n*Profile:* {{ $('Webhook').first().json.profileUrl }}\n*User ID:* {{ $('Webhook').first().json.user_id }}\n*Error:* {{ $json.error }}\n*Time:* {{ new Date().toISOString() }}"
      }
    }
  ]
}
```

### Step 7: Add Response Node

**Node Type**: Respond to Webhook
**Configuration**:
```json
{
  "respondWith": "json",
  "responseBody": {
    "status": "={{ $('HTTP Request').first().json.status }}",
    "execution_id": "={{ $runData.execution.id }}",
    "timestamp": "={{ new Date().toISOString() }}",
    "message": "={{ $('HTTP Request').first().json.message || $('HTTP Request').first().json.error }}"
  }
}
```

## Workflow Flow

```
Webhook Trigger → Supabase (Fetch Cookies) → JavaScript (Process Cookies) → HTTP Request (Browserless) → [Slack Alert if Error] → Respond to Webhook
```

## Testing the Workflow

1. **Save and Activate** the workflow in n8n
2. **Copy the webhook URL** from the webhook trigger node
3. **Update your environment variable** `N8N_LINKEDIN_CONNECT_WEBHOOK_URL`
4. **Test from HirePilot backend**:

```bash
curl -X POST http://localhost:3001/api/linkedin/send-connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/test-profile/",
    "message": "Hi! I would love to connect with you.",
    "lead_id": "optional-lead-uuid"
  }'
```

## Monitoring and Troubleshooting

### n8n Dashboard
- Monitor executions in n8n's execution dashboard
- Check execution logs for detailed error information
- Set up email notifications for failed executions

### Common Issues

1. **Cookie Expiration**: 
   - Cookies need to be refreshed regularly
   - Users should be prompted to update LinkedIn sessions

2. **LinkedIn UI Changes**:
   - Button selectors may need updates
   - Monitor for "manual_review_needed" responses

3. **Rate Limiting**:
   - LinkedIn has daily connection limits
   - Implement proper rate limiting in HirePilot

4. **Browserless Timeouts**:
   - Default timeout is 60 seconds
   - Adjust based on your needs

### Success Metrics to Monitor

- Success rate (target: >90%)
- Average execution time (target: <45 seconds)
- Manual review rate (target: <5%)
- Error rate (target: <5%)

## Security Considerations

1. **Cookie Storage**: Cookies are encrypted in Supabase
2. **Webhook Security**: Consider adding authentication to n8n webhook
3. **Environment Variables**: Store tokens securely
4. **Monitoring**: Log all automation attempts for audit trail

## Next Steps

Once this workflow is operational, you can replicate the pattern for:
- Profile scraping automation
- Post liking automation
- Following users automation
- Messaging existing connections

## Environment Variables Summary

```bash
# Required for n8n Integration
N8N_LINKEDIN_CONNECT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/linkedin-connect-automation

# Existing (already configured)
BROWSERLESS_TOKEN=your_browserless_token_here
BROWSERLESS_URL=https://production-sfo.browserless.io

# Optional for enhanced monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

---

**Note**: This integration provides a robust automation layer while maintaining the flexibility to handle edge cases manually. Monitor the success rate and adjust selectors as needed when LinkedIn updates their UI.