# REX Orchestrator Guide

The REX Orchestrator provides a structured wizard interface for guiding users through complex AI Agent workflows. This system enables REX to collect parameters, validate inputs, and execute multi-step processes through conversational interactions.

## 🎯 Overview

The REX Orchestrator transforms natural language requests into structured workflows with:
- **Parameter extraction** from conversational input
- **Interactive wizards** for collecting missing information
- **Validation and confirmation** steps
- **Execution orchestration** of multiple API calls
- **Session management** for multi-step interactions

## 🏗️ Architecture

### Core Components

#### 1. **Schemas (`schemas.ts`)**
- `SourcingParams` - Parameter validation for sourcing campaigns
- `WizardCard` - UI card structure for REX responses
- `AgentPlan` - Extracted plan from user input
- `WizardState` - Session state management

#### 2. **Prompts (`prompts.ts`)**
- `SOURCE_EXTRACT` - AI prompt for parameter extraction
- `WIZARD_MESSAGES` - Standardized user messages
- `ERROR_MESSAGES` - Error handling responses

#### 3. **Orchestrator (`index.ts`)**
- `startSourcingWizard()` - Initialize wizard from user input
- `handleWizardStep()` - Process user interactions
- `executeSourcing()` - Execute final campaign creation

#### 4. **Utilities (`utils.ts`)**
- `WizardSessionManager` - Session lifecycle management
- `ParameterProcessor` - Input validation and normalization
- `LeadGenerator` - Mock lead generation for testing
- `CampaignAnalytics` - Performance metrics and reporting

## 🚀 Usage Examples

### Basic Campaign Creation

```typescript
// User says: "Create a sourcing campaign for software engineers"
const result = await startSourcingWizard(
  "Create a sourcing campaign for software engineers",
  tools,
  { id: "user-123" }
);

// REX responds with wizard card:
{
  title: "Choose Email Sender",
  body_md: "Select which verified email sender to use...",
  actions: [
    { id: "use_existing", type: "select", options: ["John <john@company.com>"] },
    { id: "connect_sender", type: "button", label: "Connect New Sender" }
  ],
  session_id: "wizard_123456789_abc123"
}
```

### Handling User Responses

```typescript
// User selects sender
const nextStep = await handleWizardStep(
  "wizard_123456789_abc123",
  { id: "use_existing", value: "sender-1" },
  tools,
  { id: "user-123" }
);

// REX shows title selection
{
  title: "Select Target Titles",
  body_md: "Choose the job titles you want to target...",
  actions: [
    { 
      id: "titles", 
      type: "chips", 
      options: ["Head of Talent", "Recruiting Manager", "Technical Recruiter"]
    }
  ]
}
```

### Campaign Execution

```typescript
// User confirms and runs campaign
const finalResult = await handleWizardStep(
  sessionId,
  { id: "run_now" },
  tools,
  user
);

// Returns success message:
"✅ Campaign 'Software Engineers Campaign' launched successfully!
📊 Stats: 50 leads added, 3 email steps scheduled"
```

## 🔧 Parameter Extraction

The orchestrator uses AI to extract structured parameters from natural language:

### Input Processing
```typescript
// User input: "Reach out to 200 recruiting managers in tech companies with 3-day spacing"

// Extracted plan:
{
  "agent_key": "sourcing",
  "goal": "Reach out to recruiting managers in technology industry",
  "params": {
    "title_groups": ["Recruiting Manager", "Talent Acquisition Manager"],
    "industry": "Technology",
    "limit": 200,
    "spacing_business_days": 3,
    "campaign_title": "Tech Recruiting Managers Outreach"
  },
  "needs_confirmation": true,
  "missing": ["sender_id"]
}
```

### Parameter Validation
```typescript
const SourcingParams = z.object({
  title_groups: z.array(z.string()).min(1),
  industry: z.string().optional(),
  location: z.string().optional(),
  limit: z.number().int().min(10).max(5000).default(500),
  spacing_business_days: z.number().int().min(1).max(5).default(2),
  campaign_title: z.string().default(() => `Sourcing – Week ${new Date().toLocaleDateString()}`),
  track_and_assist_replies: z.boolean().default(true)
});
```

## 🎨 Wizard UI Components

### Card Types

#### **Selection Card**
```typescript
{
  title: "Choose Email Sender",
  body_md: "Select your verified sender:",
  actions: [
    {
      id: "sender",
      type: "select",
      label: "Email Sender",
      options: ["John <john@company.com>", "Jane <jane@company.com>"]
    }
  ]
}
```

#### **Multi-Choice Card**
```typescript
{
  title: "Select Target Titles",
  actions: [
    {
      id: "titles",
      type: "chips",
      options: ["Software Engineer", "Senior Developer", "Tech Lead"]
    }
  ]
}
```

#### **Input Card**
```typescript
{
  title: "Custom Titles",
  actions: [
    {
      id: "custom_titles",
      type: "input",
      placeholder: "Enter comma-separated titles",
      required: true
    }
  ]
}
```

#### **Confirmation Card**
```typescript
{
  title: "Review Campaign Details",
  body_md: "**Campaign:** Software Engineers\n**Titles:** Software Engineer, Senior Developer\n**Spacing:** 2 business days",
  actions: [
    { id: "run_now", type: "button", label: "🚀 Launch Campaign" },
    { id: "cancel", type: "button", label: "Cancel" }
  ]
}
```

## 📊 Session Management

### Session Lifecycle
1. **Creation** - User starts wizard, session created with unique ID
2. **Updates** - Each user interaction updates session state
3. **Persistence** - Sessions stored in memory/database for reliability
4. **Cleanup** - Expired sessions automatically removed
5. **Completion** - Session deleted after successful execution

### Session Storage
```typescript
class WizardSessionManager {
  static async createSession(userId: string, params: Partial<SourcingParamsT>): Promise<string>
  static getSession(sessionId: string): WizardStateT | null
  static updateSession(sessionId: string, updates: Partial<WizardStateT>): boolean
  static deleteSession(sessionId: string): boolean
  static cleanupExpiredSessions(): number
}
```

## 🔄 Workflow States

### State Machine
```
extract → sender → titles → summary → execute → complete
   ↓        ↓        ↓        ↓         ↓         ↓
 [AI]   [Select]  [Chips]  [Review]  [API]   [Done]
```

### State Transitions
- **extract** → Parse user input, validate parameters
- **sender** → Select or connect email sender
- **titles** → Choose target job titles
- **summary** → Review and confirm all details
- **execute** → Run campaign creation workflow
- **complete** → Show success message and cleanup

## 🛠️ Integration with MCP Tools

The orchestrator calls MCP tools in sequence:

```typescript
async function executeSourcing(params, tools, user) {
  // 1. Create campaign
  const campaign = await tools.call('sourcing_create_campaign', {
    userId: user.id,
    title: params.campaign_title,
    sender_id: params.sender_id
  });

  // 2. Generate sequence
  await tools.call('sourcing_save_sequence', {
    campaign_id: campaign.id,
    title_groups: params.title_groups,
    industry: params.industry
  });

  // 3. Add leads
  await tools.call('sourcing_add_leads', {
    campaign_id: campaign.id,
    leads: generatedLeads
  });

  // 4. Schedule sends
  await tools.call('sourcing_schedule_sends', {
    campaign_id: campaign.id
  });
}
```

## 🎯 Conversation Examples

### Complete Workflow
```
User: "I need to hire React developers for my startup"

REX: I'll help you create a sourcing campaign for React developers. 
     First, let me check your email senders...

[Shows sender selection card]

User: [Selects "john@startup.com"]

REX: Great! Now let's define the target titles:

[Shows title selection with chips: "React Developer", "Frontend Engineer", "JavaScript Developer"]

User: [Selects "React Developer" and "Frontend Engineer"]

REX: Perfect! Here's your campaign summary:
     
     **Campaign:** React Developers Hiring Campaign
     **Titles:** React Developer, Frontend Engineer  
     **Industry:** Technology
     **Sequence:** 3 steps, 2 business days apart
     
     Ready to launch?

User: [Clicks "Launch Campaign"]

REX: 🚀 Campaign launched successfully! 
     I've added 150 leads and scheduled your 3-step sequence.
     You'll receive notifications when leads start replying.
```

### Error Handling
```
User: "Create a campaign"

REX: I'd be happy to help you create a sourcing campaign! 
     What job titles are you looking to target? 
     For example: "Software Engineer", "Product Manager", or "Sales Director"

User: "Target people in San Francisco"

REX: I understand you want to target people in San Francisco. 
     Could you specify which job titles or roles you're looking for?
     
     Missing: title_groups
```

## 📈 Analytics and Monitoring

### Performance Metrics
```typescript
const metrics = await CampaignAnalytics.getCampaignMetrics(campaignId);

// Returns:
{
  total_leads: 150,
  emails_sent: 45,
  replies_received: 8,
  positive_replies: 5,
  reply_rate: 17.8,
  positive_rate: 62.5,
  performance_grade: "A"
}
```

### Wizard Analytics
- Session completion rates
- Drop-off points in wizard flow
- Most common parameter combinations
- Error frequency and types
- Average time to completion

## 🔧 Configuration

### Environment Variables
```bash
OPENAI_API_KEY=your-openai-key-here
BACKEND_BASE_URL=https://api.yourdomain.com
AGENTS_API_TOKEN=your-jwt-token-here
```

### Customization Options
- **Wizard steps** - Add/remove steps in workflow
- **Parameter schemas** - Modify validation rules
- **UI components** - Customize card layouts and actions
- **AI prompts** - Adjust extraction and classification prompts
- **Session timeouts** - Configure session expiration

## 🧪 Testing

### Test Suite
```bash
# Run orchestrator tests
npm run test:rex-orchestrator

# Test specific components
npm run test:rex-sourcing
npm run test:sourcing
```

### Mock Data
The test suite includes:
- Mock MCP tools for API simulation
- Sample conversation flows
- Parameter validation tests
- Session management tests
- Error handling scenarios

## 🚀 Deployment

### Production Considerations
1. **Session Storage** - Use Redis or database instead of memory
2. **Rate Limiting** - Implement API rate limits for AI calls
3. **Monitoring** - Track wizard completion rates and errors
4. **Caching** - Cache common parameter combinations
5. **Scaling** - Handle concurrent wizard sessions

### Performance Optimization
- **Lazy Loading** - Load wizard steps on demand
- **Parameter Caching** - Cache validated parameter sets
- **AI Response Caching** - Cache common extraction results
- **Session Cleanup** - Regular cleanup of expired sessions

---

*REX Orchestrator - Structured workflows for conversational AI* 🎭✨
