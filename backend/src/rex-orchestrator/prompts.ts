export const SOURCE_EXTRACT = `
You convert a user instruction into a JSON plan for the Sourcing Agent.
Only valid JSON. No prose.
{
 "agent_key": "sourcing",
 "goal": string,
 "params": object,
 "needs_confirmation": boolean,
 "missing": string[]
}

Rules:
- If required parameters are missing (e.g., title_groups or sender), set needs_confirmation=true and list missing.
- Default spacing_business_days=2, product_name="HirePilot".
- Extract title_groups from job titles mentioned (e.g., "recruiters" → ["Recruiter", "Technical Recruiter"])
- Extract industry from context (e.g., "tech companies" → "Technology")
- Extract location if mentioned (e.g., "in San Francisco" → "San Francisco Bay Area")
- Set campaign_title based on the goal (e.g., "Q1 Engineering Recruitment")
- If user mentions email tracking/replies, set track_and_assist_replies accordingly

Examples:

User: "Create a sourcing campaign for software engineers"
{
  "agent_key": "sourcing",
  "goal": "Create sourcing campaign targeting software engineers",
  "params": {
    "title_groups": ["Software Engineer", "Senior Software Engineer"],
    "campaign_title": "Software Engineers Sourcing Campaign",
    "product_name": "HirePilot",
    "spacing_business_days": 2,
    "track_and_assist_replies": true
  },
  "needs_confirmation": true,
  "missing": ["sender_id"]
}

User: "I want to reach out to 200 recruiting managers in tech companies with a 3-day spacing"
{
  "agent_key": "sourcing",
  "goal": "Reach out to recruiting managers in technology industry",
  "params": {
    "title_groups": ["Recruiting Manager", "Talent Acquisition Manager"],
    "industry": "Technology",
    "limit": 200,
    "spacing_business_days": 3,
    "campaign_title": "Tech Recruiting Managers Outreach",
    "product_name": "HirePilot",
    "track_and_assist_replies": true
  },
  "needs_confirmation": true,
  "missing": ["sender_id"]
}

User: "Start a campaign for VPs of People in SF, don't track replies"
{
  "agent_key": "sourcing",
  "goal": "Target VPs of People in San Francisco area",
  "params": {
    "title_groups": ["VP People", "VP of People", "Vice President People"],
    "location": "San Francisco Bay Area",
    "campaign_title": "SF VPs of People Campaign",
    "product_name": "HirePilot",
    "spacing_business_days": 2,
    "track_and_assist_replies": false
  },
  "needs_confirmation": true,
  "missing": ["sender_id"]
}
`;

export const SEQUENCE_OPTIMIZATION = `
You are helping optimize an email sequence for a sourcing campaign.
Based on the campaign parameters, suggest improvements to the generated sequence.

Consider:
- Target audience (title_groups, industry, location)
- Product positioning for HirePilot
- Email spacing and timing
- Personalization opportunities
- Call-to-action effectiveness

Provide specific, actionable suggestions in JSON format:
{
  "suggestions": [
    {
      "step": 1 | 2 | 3,
      "type": "subject" | "body" | "timing" | "personalization",
      "current": "current text",
      "suggested": "improved text",
      "reason": "explanation for improvement"
    }
  ],
  "overall_score": 1-10,
  "key_improvements": ["improvement 1", "improvement 2"]
}
`;

export const REPLY_CLASSIFICATION_PROMPT = `
Classify this email reply from a sourcing campaign prospect.

Categories:
- positive: Interested, wants to learn more, positive response
- neutral: Neutral response, needs follow-up, asking questions  
- negative: Not interested, rejection, negative response
- oos: Out-of-scope, unrelated content, forwarded messages
- auto: Out-of-office, auto-reply, vacation messages

Suggested Actions:
- reply: Send follow-up email
- book: Try to book a meeting/call
- disqualify: Remove from campaign
- hold: Wait before next action

Return JSON only:
{
  "classification": "positive" | "neutral" | "negative" | "oos" | "auto",
  "confidence": 0.0-1.0,
  "next_action": "reply" | "book" | "disqualify" | "hold",
  "reasoning": "brief explanation",
  "sentiment_score": -1.0 to 1.0,
  "key_phrases": ["phrase1", "phrase2"],
  "suggested_response": "brief suggested reply if applicable"
}
`;

export const CAMPAIGN_ANALYSIS = `
Analyze this sourcing campaign's performance and provide insights.

Campaign Data:
- Total leads: {total_leads}
- Emails sent: {emails_sent}
- Replies received: {replies_received}
- Positive replies: {positive_replies}
- Meetings booked: {meetings_booked}
- Bounce rate: {bounce_rate}
- Unsubscribe rate: {unsubscribe_rate}

Provide analysis in JSON format:
{
  "performance_score": 1-10,
  "reply_rate": percentage,
  "conversion_rate": percentage,
  "key_insights": ["insight 1", "insight 2"],
  "recommendations": [
    {
      "type": "sequence" | "targeting" | "timing" | "content",
      "suggestion": "specific recommendation",
      "expected_impact": "high" | "medium" | "low"
    }
  ],
  "benchmark_comparison": {
    "industry_average_reply_rate": percentage,
    "performance_vs_benchmark": "above" | "at" | "below"
  }
}
`;

export const WIZARD_MESSAGES = {
  WELCOME: "I'll help you create a sourcing campaign. What roles are you looking to fill?",
  
  MISSING_TITLES: "I need to know which job titles to target. For example: 'Head of Talent', 'Recruiting Manager', or 'Technical Recruiter'.",
  
  MISSING_SENDER: "To protect your domain reputation, you'll need a verified SendGrid sender. Would you like to connect one or use an existing sender?",
  
  CONFIRM_DETAILS: "Let me confirm the campaign details before we launch:",
  
  CAMPAIGN_LAUNCHED: "🚀 Your sourcing campaign is now live! I'll notify you when leads start replying.",
  
  CAMPAIGN_ERROR: "There was an issue launching your campaign. Let me help you troubleshoot.",
  
  INVALID_INPUT: "I didn't understand that input. Could you please try again?",
  
  WIZARD_TIMEOUT: "This wizard session has expired. Would you like to start a new sourcing campaign?",
  
  PROCESSING: "Processing your request... This may take a moment.",
  
  SUCCESS_WITH_STATS: "✅ Campaign '{campaign_title}' launched successfully!\n\n📊 **Stats:**\n• {lead_count} leads added\n• {sequence_steps} email steps scheduled\n• First emails sending now\n• Follow-ups in {spacing} business days"
} as const;

export const ERROR_MESSAGES = {
  INVALID_TITLES: "Please provide at least one valid job title (e.g., 'Recruiter', 'Head of Talent').",
  
  NO_SENDER_AVAILABLE: "No verified email senders found. Please connect SendGrid or configure an email sender first.",
  
  CAMPAIGN_CREATION_FAILED: "Failed to create campaign. Please try again or contact support.",
  
  SEQUENCE_GENERATION_FAILED: "Failed to generate email sequence. Using default template.",
  
  LEAD_ADDITION_FAILED: "Failed to add leads to campaign. Please check your lead data.",
  
  SCHEDULING_FAILED: "Failed to schedule campaign emails. Please try again.",
  
  WIZARD_STATE_ERROR: "Wizard state corrupted. Starting fresh session.",
  
  PERMISSION_DENIED: "You don't have permission to create sourcing campaigns. Please upgrade your plan.",
  
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a moment before trying again."
} as const;
