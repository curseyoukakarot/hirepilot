# 🧪 Sourcing Agent API - Quick cURL Commands

## Environment Setup
```bash
export API="http://localhost:8080"
export AUTH_TOKEN="your-jwt-token-here"  # Optional
```

## Core Workflow Commands

### 1️⃣ Create Campaign
```bash
curl -X POST $API/api/sourcing/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "title": "RevOps ICP – Week 34",
    "audience_tag": "SaaS"
  }'
```

**Expected Response:**
```json
{
  "id": "campaign-uuid-here",
  "title": "RevOps ICP – Week 34",
  "audience_tag": "SaaS",
  "status": "draft",
  "created_at": "2025-01-23T..."
}
```

### 2️⃣ Generate Email Sequence
```bash
# Replace <CID> with campaign ID from step 1
curl -X POST $API/api/sourcing/campaigns/<CID>/sequence \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "title_groups": ["Head of RevOps", "RevOps Manager"],
    "industry": "SaaS",
    "product_name": "HirePilot",
    "spacing_business_days": 2
  }'
```

**Expected Response:**
```json
{
  "id": "sequence-uuid-here",
  "campaign_id": "campaign-uuid-here",
  "steps_json": {
    "step1": {
      "subject": "Quick question about RevOps at {{company}}",
      "body": "Hi {{name}},\n\nI noticed you're leading RevOps at {{company}}..."
    },
    "step2": { "subject": "...", "body": "..." },
    "step3": { "subject": "...", "body": "..." },
    "spacingBusinessDays": 2
  }
}
```

### 3️⃣ Add Leads to Campaign
```bash
curl -X POST $API/api/sourcing/campaigns/<CID>/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "leads": [
      {
        "name": "Pat Doe",
        "title": "Head of RevOps",
        "company": "Acme Corp",
        "email": "pat@acme.com",
        "linkedin_url": "https://linkedin.com/in/patdoe"
      },
      {
        "name": "Alex Smith",
        "title": "RevOps Manager",
        "company": "TechStart Inc", 
        "email": "alex@techstart.com",
        "domain": "techstart.com"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "inserted": 2
}
```

### 4️⃣ Schedule Email Sends
```bash
# ⚠️ This will send real emails! Make sure you're ready
curl -X POST $API/api/sourcing/campaigns/<CID>/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Expected Response:**
```json
{
  "scheduled": 2
}
```

## 📊 Monitoring & Management Commands

### Get Campaign Details
```bash
curl -X GET $API/api/sourcing/campaigns/<CID> \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### List All Campaigns
```bash
curl -X GET $API/api/sourcing/campaigns \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Filter Campaigns by Status
```bash
curl -X GET "$API/api/sourcing/campaigns?status=running" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Get Campaign Replies
```bash
curl -X GET $API/api/sourcing/campaigns/<CID>/replies \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Get Campaign Leads
```bash
curl -X GET $API/api/sourcing/campaigns/<CID>/leads \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

## 🎛️ Campaign Control Commands

### Pause Campaign
```bash
curl -X POST $API/api/sourcing/campaigns/<CID>/pause \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Resume Campaign
```bash
curl -X POST $API/api/sourcing/campaigns/<CID>/resume \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

## 📧 Email Sender Management

### List Email Senders
```bash
curl -X GET $API/api/sourcing/senders \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

### Create Email Sender
```bash
curl -X POST $API/api/sourcing/senders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "from_name": "Your Name",
    "from_email": "you@yourdomain.com",
    "domain_verified": true,
    "warmup_mode": false
  }'
```

## 💬 Reply Management Commands

### Book Demo from Reply
```bash
curl -X POST $API/api/sourcing/replies/<REPLY_ID>/book-demo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"lead_id": "<LEAD_ID>"}'
```

### Disqualify Lead from Reply
```bash
curl -X POST $API/api/sourcing/replies/<REPLY_ID>/disqualify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"lead_id": "<LEAD_ID>"}'
```

## 🧪 Complete Test Workflow

```bash
#!/bin/bash
# Complete workflow test

# 1. Set environment
export API="http://localhost:8080"
export AUTH_TOKEN="your-token-here"

# 2. Create campaign
CAMPAIGN=$(curl -s -X POST $API/api/sourcing/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"title":"Test Campaign","audience_tag":"Tech"}')

# 3. Extract campaign ID (requires jq)
CID=$(echo $CAMPAIGN | jq -r '.id')
echo "Created campaign: $CID"

# 4. Generate sequence
curl -X POST $API/api/sourcing/campaigns/$CID/sequence \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"title_groups":["Head of Engineering"],"product_name":"HirePilot"}'

# 5. Add test leads
curl -X POST $API/api/sourcing/campaigns/$CID/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"leads":[{"name":"Test Lead","email":"test@example.com","title":"Head of Engineering","company":"Test Corp"}]}'

# 6. Get campaign details
curl -X GET $API/api/sourcing/campaigns/$CID \
  -H "Authorization: Bearer $AUTH_TOKEN"

echo "Campaign $CID ready for scheduling!"
```

## 🚨 Important Notes

### Authentication
- Include `Authorization: Bearer $AUTH_TOKEN` header if authentication is enabled
- Token should be a valid JWT with appropriate permissions

### Campaign IDs
- Replace `<CID>` with actual campaign UUID from create response
- Replace `<REPLY_ID>` and `<LEAD_ID>` with actual UUIDs from replies

### Email Sending
- **BE CAREFUL** with `/schedule` endpoint - it sends real emails!
- Test with internal email addresses first
- Ensure SendGrid is properly configured

### Error Handling
- Check HTTP status codes (200/201 = success, 400/500 = error)
- Parse JSON error messages for debugging
- Validate required fields before sending requests

## 🔧 Troubleshooting

### Common Issues
1. **401 Unauthorized** - Check AUTH_TOKEN
2. **404 Not Found** - Verify API endpoint and campaign ID
3. **400 Bad Request** - Check JSON syntax and required fields
4. **500 Internal Error** - Check server logs and database connection

### Debug Commands
```bash
# Test API connectivity
curl -I $API/health

# Verbose output for debugging
curl -v -X GET $API/api/sourcing/campaigns

# Pretty print JSON responses
curl -s $API/api/sourcing/campaigns | jq '.'
```

---

**🚀 Ready to test your Sourcing Agent API!**
