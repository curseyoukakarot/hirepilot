# REX Sourcing Agent Integration

This document explains how REX (the AI assistant) can control sourcing campaigns through conversational commands using MCP (Model Context Protocol) tools.

## 🤖 Overview

REX can now create, manage, and execute sourcing campaigns through natural language conversations. Users can simply tell REX what they want to accomplish, and REX will use the appropriate sourcing tools to make it happen.

## 🛠️ Available MCP Tools

### 1. `sourcing_create_campaign`
**Purpose**: Create a new sourcing campaign
**Parameters**:
- `userId` (string, required): User ID from authentication
- `title` (string, required): Campaign title
- `audience_tag` (string, optional): Audience identifier
- `sender_id` (string, optional): Email sender profile ID

**Example Usage**:
```
User: "Create a sourcing campaign for software engineers"
REX: → sourcing_create_campaign({
  userId: "user-123",
  title: "Q1 Software Engineers Outreach",
  audience_tag: "software-engineers"
})
```

### 2. `sourcing_save_sequence`
**Purpose**: Generate AI-powered 3-step email sequence
**Parameters**:
- `userId` (string, required): User ID
- `campaign_id` (string, required): Campaign UUID
- `title_groups` (array, required): Target job titles
- `industry` (string, optional): Industry context
- `product_name` (string, optional): Product/service name
- `spacing_business_days` (number, optional): Days between emails

**Example Usage**:
```
User: "Generate a 3-step sequence for this campaign targeting developers"
REX: → sourcing_save_sequence({
  userId: "user-123",
  campaign_id: "campaign-456",
  title_groups: ["Software Engineer", "Full Stack Developer"],
  industry: "Technology",
  product_name: "HirePilot",
  spacing_business_days: 2
})
```

### 3. `sourcing_add_leads`
**Purpose**: Add leads to a campaign
**Parameters**:
- `userId` (string, required): User ID
- `campaign_id` (string, required): Campaign UUID
- `leads` (array, required): Array of lead objects

**Lead Object Structure**:
```json
{
  "name": "John Doe",
  "title": "Software Engineer",
  "company": "TechCorp",
  "email": "john@techcorp.com",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "domain": "techcorp.com"
}
```

**Example Usage**:
```
User: "Add these 50 leads to the campaign"
REX: → sourcing_add_leads({
  userId: "user-123",
  campaign_id: "campaign-456",
  leads: [/* array of lead objects */]
})
```

### 4. `sourcing_schedule_sends`
**Purpose**: Launch campaign and schedule email sends
**Parameters**:
- `userId` (string, required): User ID
- `campaign_id` (string, required): Campaign UUID

**Example Usage**:
```
User: "Launch the campaign now"
REX: → sourcing_schedule_sends({
  userId: "user-123",
  campaign_id: "campaign-456"
})
```

### 5. `sourcing_get_campaign`
**Purpose**: Get detailed campaign information
**Parameters**:
- `userId` (string, required): User ID
- `campaign_id` (string, required): Campaign UUID

**Example Usage**:
```
User: "Show me the details of this campaign"
REX: → sourcing_get_campaign({
  userId: "user-123",
  campaign_id: "campaign-456"
})
```

### 6. `sourcing_list_campaigns`
**Purpose**: List user's campaigns with filtering
**Parameters**:
- `userId` (string, required): User ID
- `status` (string, optional): Filter by status (draft, running, completed, etc.)
- `search` (string, optional): Search by campaign title
- `limit` (number, optional): Maximum results to return

**Example Usage**:
```
User: "Show me my active campaigns"
REX: → sourcing_list_campaigns({
  userId: "user-123",
  status: "running",
  limit: 10
})
```

### 7. `sourcing_get_senders`
**Purpose**: List available email sender profiles
**Parameters**:
- `userId` (string, required): User ID

**Example Usage**:
```
User: "What email accounts can I use for sending?"
REX: → sourcing_get_senders({
  userId: "user-123"
})
```

## 💬 Conversation Examples

### Complete Campaign Creation Flow

```
User: "I want to create a sourcing campaign for hiring React developers"

REX: I'll help you create a sourcing campaign for React developers. Let me start by creating the campaign.

[Calls sourcing_create_campaign with title "React Developers Hiring Campaign"]

Great! I've created your campaign. Now let me generate a personalized 3-step email sequence for React developers.

[Calls sourcing_save_sequence with React-specific titles and tech industry context]

Perfect! I've generated a 3-step sequence. The emails will be spaced 2 business days apart. Would you like to add leads to this campaign now?

User: "Yes, I have a CSV with 100 React developer contacts"

REX: Excellent! Please upload your CSV and I'll process the leads and add them to your campaign.

[After CSV processing, calls sourcing_add_leads with the processed lead data]

I've successfully added 100 leads to your campaign. Everything is ready to launch. Would you like me to start the campaign now?

User: "Yes, launch it!"

REX: [Calls sourcing_schedule_sends]

🚀 Your React Developers campaign is now live! The first emails will be sent immediately, with follow-ups scheduled for 2 and 4 business days later. You'll receive notifications when leads reply.
```

### Campaign Management

```
User: "How are my sourcing campaigns performing?"

REX: [Calls sourcing_list_campaigns]

You have 3 active sourcing campaigns:

1. **React Developers Campaign** - Running
   - 100 leads, 45 emails sent
   - 8 positive replies, 2 meetings booked

2. **Backend Engineers Outreach** - Running  
   - 75 leads, 30 emails sent
   - 5 positive replies, 1 meeting booked

3. **DevOps Specialists** - Completed
   - 50 leads, all emails sent
   - 12 positive replies, 4 meetings booked

Would you like detailed information about any specific campaign?
```

## 🔧 Technical Implementation

### Authentication & Security
- All tools require premium user access (`assertPremium()`)
- API calls use `AGENTS_API_TOKEN` for authentication
- User context automatically included in all requests
- Input validation via Zod schemas

### API Integration
- Tools make HTTP requests to backend API endpoints
- Responses are parsed and returned to REX
- Error handling with descriptive messages
- Automatic retry logic for failed requests

### MCP Server Configuration
```typescript
// REX MCP server registration
server.registerCapabilities({
  tools: {
    sourcing_create_campaign: { /* tool definition */ },
    sourcing_save_sequence: { /* tool definition */ },
    // ... other tools
  }
});
```

## 🚀 Deployment

### Environment Variables
```bash
BACKEND_BASE_URL=https://api.yourdomain.com
AGENTS_API_TOKEN=your-jwt-token-here
```

### Starting REX Server
```bash
# Start the REX MCP server
npm run rex:server

# Test sourcing tools
npm run test:rex-sourcing
```

## 📊 Monitoring & Analytics

### Campaign Metrics
REX can provide real-time campaign analytics:
- Total leads processed
- Emails sent/scheduled
- Reply rates and classifications
- Meeting bookings
- Campaign ROI

### Reply Management
When leads reply, REX receives notifications and can:
- Classify replies (positive/neutral/negative)
- Suggest next actions (reply/book/disqualify)
- Update lead status automatically
- Trigger follow-up workflows

## 🎯 Use Cases

### Recruiting Teams
- "Create campaigns for different roles"
- "Generate industry-specific sequences"
- "Track hiring pipeline progress"
- "Manage candidate communications"

### Sales Teams
- "Prospect potential clients"
- "Follow up on warm leads"
- "Nurture long-term relationships"
- "Track outreach effectiveness"

### Marketing Teams
- "Reach out to potential partners"
- "Connect with industry influencers"
- "Build thought leadership networks"
- "Generate qualified leads"

## 🔮 Future Enhancements

### Planned Features
- **Smart Lead Scoring**: AI-powered lead qualification
- **Dynamic Sequences**: Adaptive email content based on replies
- **A/B Testing**: Automated sequence optimization
- **Integration Hub**: Connect with CRM, ATS, and other tools
- **Voice Commands**: Voice-activated campaign management
- **Predictive Analytics**: Forecast campaign performance

### Advanced Workflows
- **Multi-Channel Outreach**: Email + LinkedIn + Phone
- **Behavioral Triggers**: Actions based on lead behavior
- **Team Collaboration**: Shared campaigns and handoffs
- **Compliance Management**: GDPR, CAN-SPAM automation

## 📚 Resources

- [Sourcing API Documentation](./sourcing-api.md)
- [SendGrid Integration Guide](./sendgrid-sourcing-setup.md)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [REX User Guide](../frontend/docs/rex-guide.md)

---

*REX Sourcing Agent - Conversational AI for intelligent outreach campaigns* 🤖✨
