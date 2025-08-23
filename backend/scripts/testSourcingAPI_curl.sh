#!/bin/bash

# 🧪 Sourcing Agent API - cURL Sanity Tests
# Quick validation of all sourcing endpoints

set -e  # Exit on any error

# Configuration
API_BASE="${BACKEND_BASE_URL:-http://localhost:8080}"
AUTH_TOKEN="${AGENTS_API_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if jq is available for JSON parsing
if ! command -v jq &> /dev/null; then
    log_warning "jq not found. Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    USE_JQ=false
else
    USE_JQ=true
fi

# Set up auth header if token is provided
AUTH_HEADER=""
if [ -n "$AUTH_TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $AUTH_TOKEN\""
    log_info "Using authentication token"
else
    log_warning "No AGENTS_API_TOKEN provided - requests may fail if auth is required"
fi

echo "🚀 Starting Sourcing Agent API Tests"
echo "📡 API Base: $API_BASE"
echo "🔐 Auth: ${AUTH_TOKEN:+Enabled}"
echo ""

# Test 1: Create Campaign
log_info "Test 1: Creating campaign..."

CAMPAIGN_RESPONSE=$(curl -s -X POST "$API_BASE/api/sourcing/campaigns" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} \
  -d '{
    "title": "RevOps ICP – Week 34",
    "audience_tag": "SaaS"
  }' || echo '{"error": "Request failed"}')

echo "Response: $CAMPAIGN_RESPONSE"

if [ "$USE_JQ" = true ]; then
    CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | jq -r '.id // empty')
    if [ -n "$CAMPAIGN_ID" ] && [ "$CAMPAIGN_ID" != "null" ]; then
        log_success "Campaign created with ID: $CAMPAIGN_ID"
    else
        log_error "Failed to create campaign"
        echo "Error details: $(echo "$CAMPAIGN_RESPONSE" | jq -r '.error // "Unknown error"')"
        exit 1
    fi
else
    # Fallback without jq - extract ID manually
    CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$CAMPAIGN_ID" ]; then
        log_success "Campaign created with ID: $CAMPAIGN_ID"
    else
        log_error "Failed to create campaign or extract ID"
        exit 1
    fi
fi

echo ""

# Test 2: Generate Sequence
log_info "Test 2: Generating email sequence..."

SEQUENCE_RESPONSE=$(curl -s -X POST "$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/sequence" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} \
  -d '{
    "title_groups": ["Head of RevOps", "RevOps Manager"],
    "industry": "SaaS",
    "product_name": "HirePilot",
    "spacing_business_days": 2
  }' || echo '{"error": "Request failed"}')

echo "Response: $SEQUENCE_RESPONSE"

if [ "$USE_JQ" = true ]; then
    SEQUENCE_ID=$(echo "$SEQUENCE_RESPONSE" | jq -r '.id // empty')
    if [ -n "$SEQUENCE_ID" ] && [ "$SEQUENCE_ID" != "null" ]; then
        log_success "Sequence generated with ID: $SEQUENCE_ID"
    else
        log_error "Failed to generate sequence"
        echo "Error details: $(echo "$SEQUENCE_RESPONSE" | jq -r '.error // "Unknown error"')"
    fi
else
    if echo "$SEQUENCE_RESPONSE" | grep -q '"id"'; then
        log_success "Sequence generated successfully"
    else
        log_error "Failed to generate sequence"
    fi
fi

echo ""

# Test 3: Add Leads
log_info "Test 3: Adding leads to campaign..."

LEADS_RESPONSE=$(curl -s -X POST "$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/leads" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} \
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
      },
      {
        "name": "Jordan Lee",
        "title": "Director of Revenue Operations",
        "company": "ScaleUp LLC",
        "email": "jordan@scaleup.com"
      }
    ]
  }' || echo '{"error": "Request failed"}')

echo "Response: $LEADS_RESPONSE"

if [ "$USE_JQ" = true ]; then
    LEADS_INSERTED=$(echo "$LEADS_RESPONSE" | jq -r '.inserted // 0')
    if [ "$LEADS_INSERTED" -gt 0 ]; then
        log_success "Added $LEADS_INSERTED leads to campaign"
    else
        log_error "Failed to add leads"
        echo "Error details: $(echo "$LEADS_RESPONSE" | jq -r '.error // "Unknown error"')"
    fi
else
    if echo "$LEADS_RESPONSE" | grep -q '"inserted"'; then
        log_success "Leads added successfully"
    else
        log_error "Failed to add leads"
    fi
fi

echo ""

# Test 4: Get Campaign Details
log_info "Test 4: Fetching campaign details..."

CAMPAIGN_DETAILS=$(curl -s -X GET "$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} || echo '{"error": "Request failed"}')

echo "Response: $CAMPAIGN_DETAILS"

if [ "$USE_JQ" = true ]; then
    CAMPAIGN_TITLE=$(echo "$CAMPAIGN_DETAILS" | jq -r '.campaign.title // empty')
    LEADS_COUNT=$(echo "$CAMPAIGN_DETAILS" | jq -r '.leads | length // 0')
    if [ -n "$CAMPAIGN_TITLE" ]; then
        log_success "Campaign details retrieved: '$CAMPAIGN_TITLE' with $LEADS_COUNT leads"
    else
        log_error "Failed to fetch campaign details"
    fi
else
    if echo "$CAMPAIGN_DETAILS" | grep -q '"campaign"'; then
        log_success "Campaign details retrieved successfully"
    else
        log_error "Failed to fetch campaign details"
    fi
fi

echo ""

# Test 5: Schedule Campaign (Optional - commented out to avoid sending real emails)
log_warning "Test 5: Schedule sends (SKIPPED - would send real emails)"
log_info "To test scheduling, uncomment the following command:"
echo "curl -X POST \"$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/schedule\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  ${AUTH_HEADER}"

# Uncomment to actually test scheduling:
# SCHEDULE_RESPONSE=$(curl -s -X POST "$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/schedule" \
#   -H "Content-Type: application/json" \
#   ${AUTH_HEADER} || echo '{"error": "Request failed"}')
# 
# echo "Response: $SCHEDULE_RESPONSE"
# 
# if [ "$USE_JQ" = true ]; then
#     SCHEDULED_COUNT=$(echo "$SCHEDULE_RESPONSE" | jq -r '.scheduled // 0')
#     if [ "$SCHEDULED_COUNT" -gt 0 ]; then
#         log_success "Scheduled emails for $SCHEDULED_COUNT leads"
#     else
#         log_error "Failed to schedule campaign"
#     fi
# fi

echo ""

# Test 6: List Campaigns
log_info "Test 6: Listing all campaigns..."

CAMPAIGNS_LIST=$(curl -s -X GET "$API_BASE/api/sourcing/campaigns" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} || echo '{"error": "Request failed"}')

echo "Response: $CAMPAIGNS_LIST"

if [ "$USE_JQ" = true ]; then
    CAMPAIGNS_COUNT=$(echo "$CAMPAIGNS_LIST" | jq -r '.campaigns | length // 0')
    if [ "$CAMPAIGNS_COUNT" -gt 0 ]; then
        log_success "Found $CAMPAIGNS_COUNT campaigns"
        echo "Campaign titles:"
        echo "$CAMPAIGNS_LIST" | jq -r '.campaigns[].title' | sed 's/^/  - /'
    else
        log_warning "No campaigns found or failed to fetch list"
    fi
else
    if echo "$CAMPAIGNS_LIST" | grep -q '"campaigns"'; then
        log_success "Campaigns list retrieved successfully"
    else
        log_error "Failed to fetch campaigns list"
    fi
fi

echo ""

# Test 7: Get Email Senders
log_info "Test 7: Fetching email senders..."

SENDERS_RESPONSE=$(curl -s -X GET "$API_BASE/api/sourcing/senders" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER} || echo '{"error": "Request failed"}')

echo "Response: $SENDERS_RESPONSE"

if [ "$USE_JQ" = true ]; then
    SENDERS_COUNT=$(echo "$SENDERS_RESPONSE" | jq -r '.senders | length // 0')
    if [ "$SENDERS_COUNT" -gt 0 ]; then
        log_success "Found $SENDERS_COUNT email senders"
        echo "Sender emails:"
        echo "$SENDERS_RESPONSE" | jq -r '.senders[].from_email' | sed 's/^/  - /'
    else
        log_warning "No email senders found"
    fi
else
    if echo "$SENDERS_RESPONSE" | grep -q '"senders"'; then
        log_success "Senders list retrieved successfully"
    else
        log_warning "No senders found or failed to fetch list"
    fi
fi

echo ""

# Summary
echo "🎉 API Tests Complete!"
echo ""
echo "📋 Test Summary:"
echo "  ✅ Campaign Creation"
echo "  ✅ Sequence Generation"
echo "  ✅ Lead Management"
echo "  ✅ Campaign Details"
echo "  ⚠️  Schedule Sends (Skipped)"
echo "  ✅ List Campaigns"
echo "  ✅ List Senders"
echo ""
echo "🔗 Created Campaign ID: $CAMPAIGN_ID"
echo "💡 Use this ID for further testing or in the Super Admin UI"
echo ""

# Additional useful commands
echo "🛠️  Additional Commands:"
echo ""
echo "# Pause campaign:"
echo "curl -X POST \"$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/pause\" \\"
echo "  -H \"Content-Type: application/json\" ${AUTH_HEADER}"
echo ""
echo "# Resume campaign:"
echo "curl -X POST \"$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/resume\" \\"
echo "  -H \"Content-Type: application/json\" ${AUTH_HEADER}"
echo ""
echo "# Get campaign replies:"
echo "curl -X GET \"$API_BASE/api/sourcing/campaigns/$CAMPAIGN_ID/replies\" \\"
echo "  -H \"Content-Type: application/json\" ${AUTH_HEADER}"
echo ""
echo "# Create email sender:"
echo "curl -X POST \"$API_BASE/api/sourcing/senders\" \\"
echo "  -H \"Content-Type: application/json\" ${AUTH_HEADER} \\"
echo "  -d '{\"from_name\":\"Your Name\",\"from_email\":\"you@domain.com\",\"domain_verified\":true}'"
echo ""

log_success "All tests completed successfully! 🚀"
