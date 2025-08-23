# 🧪 Sourcing Agent API Testing Guide

## Quick cURL Sanity Tests

This guide provides comprehensive testing tools for the Sourcing Agent API endpoints.

## 📁 Testing Files Created

### 1. `scripts/testSourcingAPI_curl.sh` ✅
**Comprehensive automated test script**
- Full workflow testing with error handling
- Colored output and progress indicators
- JSON parsing with jq (optional)
- Authentication support
- Safe execution (skips email sending by default)

**Usage:**
```bash
# Set environment variables
export BACKEND_BASE_URL="http://localhost:8080"
export AGENTS_API_TOKEN="your-jwt-token-here"

# Run the test script
npm run test:sourcing-curl
# OR
./backend/scripts/testSourcingAPI_curl.sh
```

### 2. `scripts/sourcing-curl-commands.md` ✅
**Quick reference guide**
- Copy-paste cURL commands
- Expected responses
- Complete workflow examples
- Troubleshooting tips
- Error handling guidance

## 🚀 Core API Workflow

### Step 1: Create Campaign
```bash
curl -X POST $API/api/sourcing/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "title": "RevOps ICP – Week 34",
    "audience_tag": "SaaS"
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "title": "RevOps ICP – Week 34", 
  "status": "draft"
}
```

### Step 2: Generate Email Sequence
```bash
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

**Response:**
```json
{
  "id": "sequence-uuid",
  "steps_json": {
    "step1": {"subject": "...", "body": "..."},
    "step2": {"subject": "...", "body": "..."},
    "step3": {"subject": "...", "body": "..."},
    "spacingBusinessDays": 2
  }
}
```

### Step 3: Add Leads
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
        "email": "pat@acme.com"
      }
    ]
  }'
```

**Response:**
```json
{
  "inserted": 1
}
```

### Step 4: Schedule Sends
```bash
curl -X POST $API/api/sourcing/campaigns/<CID>/schedule \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**Response:**
```json
{
  "scheduled": 1
}
```

## 🔧 Testing Features

### Automated Test Script Features:
- ✅ **Environment detection** - Auto-detects API base URL and auth token
- ✅ **Error handling** - Graceful failure with detailed error messages
- ✅ **JSON parsing** - Extracts IDs and validates responses
- ✅ **Safety checks** - Skips email sending to prevent accidental sends
- ✅ **Progress tracking** - Clear visual feedback for each test step
- ✅ **Comprehensive coverage** - Tests all major endpoints

### Manual Testing Features:
- ✅ **Copy-paste commands** - Ready-to-use cURL examples
- ✅ **Variable substitution** - Easy ID replacement workflow
- ✅ **Response validation** - Expected JSON structures
- ✅ **Error troubleshooting** - Common issues and solutions

## 📊 Test Coverage

### Core Endpoints Tested:
- ✅ `POST /api/sourcing/campaigns` - Campaign creation
- ✅ `POST /api/sourcing/campaigns/:id/sequence` - Sequence generation
- ✅ `POST /api/sourcing/campaigns/:id/leads` - Lead addition
- ✅ `POST /api/sourcing/campaigns/:id/schedule` - Email scheduling
- ✅ `GET /api/sourcing/campaigns/:id` - Campaign details
- ✅ `GET /api/sourcing/campaigns` - Campaign listing
- ✅ `GET /api/sourcing/senders` - Sender management

### Additional Endpoints:
- ✅ `GET /api/sourcing/campaigns/:id/replies` - Reply management
- ✅ `POST /api/sourcing/campaigns/:id/pause` - Campaign control
- ✅ `POST /api/sourcing/campaigns/:id/resume` - Campaign control
- ✅ `POST /api/sourcing/senders` - Sender creation
- ✅ `POST /api/sourcing/replies/:id/book-demo` - Reply actions
- ✅ `POST /api/sourcing/replies/:id/disqualify` - Reply actions

## 🎯 Usage Scenarios

### Development Testing
```bash
# Quick API validation during development
export API="http://localhost:8080"
npm run test:sourcing-curl
```

### Staging Validation
```bash
# Test against staging environment
export BACKEND_BASE_URL="https://staging-api.yourdomain.com"
export AGENTS_API_TOKEN="staging-jwt-token"
./scripts/testSourcingAPI_curl.sh
```

### Production Smoke Tests
```bash
# Verify production deployment (be careful with scheduling!)
export BACKEND_BASE_URL="https://api.yourdomain.com"
export AGENTS_API_TOKEN="production-jwt-token"
# Edit script to enable scheduling tests if needed
./scripts/testSourcingAPI_curl.sh
```

## 🚨 Safety Considerations

### Email Sending Protection:
- **Default behavior**: Script skips `/schedule` endpoint to prevent accidental emails
- **Override**: Uncomment scheduling section in script for full testing
- **Recommendation**: Use test email addresses for initial validation

### Authentication:
- **Token security**: Never commit tokens to version control
- **Environment variables**: Use `.env` files or secure environment management
- **Permissions**: Ensure tokens have appropriate API access levels

### Data Validation:
- **Test data**: Use obviously fake data for testing (test@example.com, etc.)
- **Cleanup**: Consider adding cleanup commands to remove test campaigns
- **Monitoring**: Watch for unexpected API behavior or errors

## 🔍 Troubleshooting

### Common Issues:

#### 1. Connection Refused
```bash
curl: (7) Failed to connect to localhost port 8080: Connection refused
```
**Solution**: Ensure backend server is running on correct port

#### 2. Authentication Errors
```bash
{"error": "Unauthorized"}
```
**Solution**: Check `AGENTS_API_TOKEN` environment variable

#### 3. JSON Parse Errors
```bash
{"error": "Invalid JSON in request body"}
```
**Solution**: Validate JSON syntax with `jq` or online validator

#### 4. Missing Dependencies
```bash
jq: command not found
```
**Solution**: Install jq with `brew install jq` (macOS) or `apt-get install jq` (Ubuntu)

### Debug Commands:
```bash
# Test connectivity
curl -I $API/health

# Verbose output
curl -v -X GET $API/api/sourcing/campaigns

# Pretty print JSON
curl -s $API/api/sourcing/campaigns | jq '.'
```

## 📈 Performance Testing

### Load Testing Example:
```bash
# Create multiple campaigns rapidly
for i in {1..10}; do
  curl -X POST $API/api/sourcing/campaigns \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "{\"title\":\"Load Test Campaign $i\"}" &
done
wait
```

### Monitoring:
- Watch server logs during testing
- Monitor database connections
- Check Redis queue performance
- Validate email delivery rates

## 🎉 Success Criteria

### API Health Indicators:
- ✅ All endpoints return 200/201 status codes
- ✅ JSON responses match expected schemas
- ✅ Campaign IDs are valid UUIDs
- ✅ Sequence generation produces 3-step emails
- ✅ Lead insertion returns correct counts
- ✅ Error responses include helpful messages

### Integration Validation:
- ✅ Database records created correctly
- ✅ Redis jobs queued for email sending
- ✅ SendGrid headers included in emails
- ✅ AI sequence generation produces relevant content
- ✅ Business day calculations work correctly

---

**🚀 Ready to validate your Sourcing Agent API with comprehensive testing tools!**

Use these tools to ensure your API is production-ready and performing optimally.
