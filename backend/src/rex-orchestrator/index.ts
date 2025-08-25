import { SourcingParams, WizardCardT, AgentPlanT, COMMON_TITLE_GROUPS, COMMON_INDUSTRIES, COMMON_LOCATIONS } from './schemas';
import { SniperParams } from './schemas';
import { startSniperWizard } from './sniper';
import { SOURCE_EXTRACT, WIZARD_MESSAGES, ERROR_MESSAGES } from './prompts';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Wizard session storage (in production, use Redis or database)
const wizardSessions = new Map<string, any>();

export async function startSourcingWizard(
  text: string, 
  tools: any, 
  user: { id: string }
): Promise<WizardCardT | string> {
  try {
    // 1) Extract plan from user input using AI
    const plan = await jsonExtract(SOURCE_EXTRACT, text);
    
    if (plan.agent_key !== 'sourcing') {
      return ask(WIZARD_MESSAGES.WELCOME);
    }

    // 2) Validate parameters
    const parsed = SourcingParams.safeParse(plan.params || {});
    if (!parsed.success) {
      const missing = parsed.error.issues.map(i => i.path.join('.'));
      return ask(`${WIZARD_MESSAGES.MISSING_TITLES}\n\nMissing: ${missing.join(', ')}`);
    }

    const params = parsed.data;
    const sessionId = generateSessionId();

    // Store wizard state
    wizardSessions.set(sessionId, {
      step: 'extract',
      params,
      user_id: user.id,
      session_id: sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 3) Check for sender
    if (!params.sender_id) {
      return await senderSelectionCard(sessionId, tools, user);
    }

    // 4) Confirm titles if missing or unclear
    if (!params.title_groups?.length) {
      return titleSelectionCard(sessionId);
    }

    // 5) Show summary and confirmation
    return summaryCard(sessionId, params);

  } catch (error) {
    console.error('Error in startSourcingWizard:', error);
    return ask(ERROR_MESSAGES.WIZARD_STATE_ERROR);
  }
}

// Lightweight router: direct entrypoint for Sniper wizard
export async function orchestrate(text: string, tools: any, user: { id: string }): Promise<WizardCardT | string> {
  // Try Sniper intent first
  const lowered = text.toLowerCase();
  if (/(sniper|watch|keyword|competitor|post url|likes|comments)/.test(lowered)) {
    try { return await startSniperWizard(text, tools, user); } catch (e) { /* fallthrough */ }
  }
  // Default to sourcing wizard
  return await startSourcingWizard(text, tools, user);
}

export async function handleWizardStep(
  sessionId: string,
  action: { id: string; value?: any },
  tools: any,
  user: { id: string }
): Promise<WizardCardT | string> {
  try {
    const session = wizardSessions.get(sessionId);
    if (!session) {
      return ask(WIZARD_MESSAGES.WIZARD_TIMEOUT);
    }

    session.updated_at = new Date().toISOString();

    switch (action.id) {
      case 'connect_sender':
        return connectSenderCard(sessionId);
        
      case 'use_existing':
        session.params.sender_id = action.value;
        wizardSessions.set(sessionId, session);
        return titleSelectionCard(sessionId);
        
      case 'titles':
        const selectedTitles = Array.isArray(action.value) ? action.value : [action.value];
        session.params.title_groups = selectedTitles;
        wizardSessions.set(sessionId, session);
        return summaryCard(sessionId, session.params);
        
      case 'custom_titles':
        const customTitles = action.value.split(',').map((t: string) => t.trim()).filter(Boolean);
        session.params.title_groups = customTitles;
        wizardSessions.set(sessionId, session);
        return summaryCard(sessionId, session.params);
        
      case 'industry':
        session.params.industry = action.value;
        wizardSessions.set(sessionId, session);
        return summaryCard(sessionId, session.params);
        
      case 'location':
        session.params.location = action.value;
        wizardSessions.set(sessionId, session);
        return summaryCard(sessionId, session.params);
        
      case 'run_now':
        return await executeSourcing(session.params, tools, user);
        
      case 'cancel':
        wizardSessions.delete(sessionId);
        return ask("Campaign creation cancelled. Let me know if you'd like to start another one!");
        
      default:
        return ask(WIZARD_MESSAGES.INVALID_INPUT);
    }
  } catch (error) {
    console.error('Error in handleWizardStep:', error);
    return ask(ERROR_MESSAGES.WIZARD_STATE_ERROR);
  }
}

async function senderSelectionCard(sessionId: string, tools: any, user: { id: string }): Promise<WizardCardT> {
  try {
    const senders = await listVerifiedSenders(tools, user);
    
    if (senders.length === 0) {
      return wizardCard({
        title: "Connect Email Sender",
        body_md: "You need a verified SendGrid sender to protect your domain reputation and ensure deliverability.\n\n**Why this matters:**\n• Higher inbox delivery rates\n• Better sender reputation\n• Compliance with email standards",
        actions: [
          { id: "connect_sender", type: "button", label: "Connect SendGrid" }
        ],
        session_id: sessionId,
        step: "sender"
      });
    }

    return wizardCard({
      title: "Choose Email Sender",
      body_md: "Select which verified email sender to use for this campaign:",
      actions: [
        { 
          id: "use_existing", 
          type: "select", 
          label: "Email Sender", 
          options: senders.map(s => `${s.from_name} <${s.from_email}>`)
        },
        { id: "connect_sender", type: "button", label: "Connect New Sender" }
      ],
      session_id: sessionId,
      step: "sender"
    });
  } catch (error) {
    console.error('Error getting senders:', error);
    return wizardCard({
      title: "Email Sender Required",
      body_md: ERROR_MESSAGES.NO_SENDER_AVAILABLE,
      actions: [
        { id: "connect_sender", type: "button", label: "Connect SendGrid" }
      ],
      session_id: sessionId,
      step: "sender"
    });
  }
}

function titleSelectionCard(sessionId: string): WizardCardT {
  return wizardCard({
    title: "Select Target Titles",
    body_md: "Choose the job titles you want to target in this sourcing campaign:",
    actions: [
      { 
        id: "titles", 
        type: "chips", 
        label: "Common Titles",
        options: [...COMMON_TITLE_GROUPS]
      },
      { 
        id: "custom_titles", 
        type: "input", 
        label: "Custom Titles",
        placeholder: "Enter comma-separated titles (e.g., Chief People Officer, Director of Talent)"
      }
    ],
    session_id: sessionId,
    step: "titles"
  });
}

function summaryCard(sessionId: string, params: any): WizardCardT {
  const titlesList = params.title_groups?.join(', ') || 'Not specified';
  const industry = params.industry || 'Any industry';
  const location = params.location || 'Any location';
  
  return wizardCard({
    title: "Review Campaign Details",
    body_md: `**Campaign:** ${params.campaign_title}
    
**Target Titles:** ${titlesList}
**Industry:** ${industry}
**Location:** ${location}
**Email Sequence:** 3 steps with ${params.spacing_business_days} business day spacing
**Lead Limit:** ${params.limit} leads
**Track Replies:** ${params.track_and_assist_replies ? 'Yes' : 'No'}

Ready to launch this sourcing campaign?`,
    actions: [
      { id: "run_now", type: "button", label: "🚀 Launch Campaign" },
      { id: "cancel", type: "button", label: "Cancel" }
    ],
    session_id: sessionId,
    step: "summary"
  });
}

function connectSenderCard(sessionId: string): WizardCardT {
  return wizardCard({
    title: "Connect SendGrid Sender",
    body_md: `To send emails, you need to verify a sender with SendGrid:

**Steps:**
1. Go to SendGrid → Settings → Sender Authentication
2. Verify your domain or single sender
3. Return here to continue

**Benefits:**
• Higher delivery rates
• Better sender reputation  
• Professional appearance`,
    actions: [
      { id: "sender_connected", type: "button", label: "I've Connected SendGrid" },
      { id: "cancel", type: "button", label: "Cancel for Now" }
    ],
    session_id: sessionId,
    step: "connect_sender"
  });
}

export async function executeSourcing(params: any, tools: any, user: { id: string }): Promise<string> {
  try {
    // 1) Create campaign
    console.log('Creating sourcing campaign...');
    const campaign = await tools.call('sourcing_create_campaign', {
      userId: user.id,
      title: params.campaign_title,
      audience_tag: params.audience_tag,
      sender_id: params.sender_id
    });

    // 2) Generate and save sequence
    console.log('Generating email sequence...');
    await tools.call('sourcing_save_sequence', {
      userId: user.id,
      campaign_id: campaign.id,
      title_groups: params.title_groups,
      industry: params.industry,
      product_name: params.product_name,
      spacing_business_days: params.spacing_business_days
    });

    // 3) Add leads (this would integrate with Apollo or other lead sources)
    console.log('Adding leads to campaign...');
    const leads = await generateLeadsForCampaign(params);
    if (leads.length > 0) {
      await tools.call('sourcing_add_leads', {
        userId: user.id,
        campaign_id: campaign.id,
        leads
      });
    }

    // 4) Schedule campaign
    console.log('Scheduling campaign sends...');
    const result = await tools.call('sourcing_schedule_sends', {
      userId: user.id,
      campaign_id: campaign.id
    });

    // Clean up wizard session
    const sessionId = Object.keys(wizardSessions).find(key => 
      wizardSessions.get(key)?.user_id === user.id
    );
    if (sessionId) {
      wizardSessions.delete(sessionId);
    }

    return WIZARD_MESSAGES.SUCCESS_WITH_STATS
      .replace('{campaign_title}', campaign.title)
      .replace('{lead_count}', leads.length.toString())
      .replace('{sequence_steps}', '3')
      .replace('{spacing}', params.spacing_business_days.toString());

  } catch (error) {
    console.error('Error executing sourcing campaign:', error);
    return ERROR_MESSAGES.CAMPAIGN_CREATION_FAILED;
  }
}

// Helper functions
async function jsonExtract(prompt: string, text: string): Promise<AgentPlanT> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('Error in jsonExtract:', error);
    return {
      agent_key: 'sourcing',
      goal: text,
      params: {},
      needs_confirmation: true,
      missing: ['title_groups']
    };
  }
}

async function listVerifiedSenders(tools: any, user: { id: string }): Promise<any[]> {
  try {
    const result = await tools.call('sourcing_get_senders', { userId: user.id });
    return result.filter((sender: any) => sender.domain_verified) || [];
  } catch (error) {
    console.error('Error listing senders:', error);
    return [];
  }
}

async function generateLeadsForCampaign(params: any): Promise<any[]> {
  // This would integrate with Apollo, LinkedIn Sales Navigator, or other lead sources
  // For now, return mock leads for testing
  console.log('Generating leads for campaign with params:', params);
  
  // In production, this would call Apollo API or other lead generation services
  return [
    {
      name: "Sample Lead 1",
      title: params.title_groups[0],
      company: "Tech Corp",
      email: "sample1@techcorp.com",
      linkedin_url: "https://linkedin.com/in/sample1"
    },
    {
      name: "Sample Lead 2", 
      title: params.title_groups[0],
      company: "StartupXYZ",
      email: "sample2@startupxyz.com",
      linkedin_url: "https://linkedin.com/in/sample2"
    }
  ];
}

function generateSessionId(): string {
  return `wizard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function wizardCard(card: Omit<WizardCardT, 'actions'> & { actions: any[] }): WizardCardT {
  return {
    title: card.title,
    body_md: card.body_md,
    actions: card.actions,
    next: card.next,
    session_id: card.session_id,
    step: card.step
  };
}

function ask(message: string): string {
  return message;
}

function done(message: string): string {
  return message;
}
