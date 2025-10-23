export type WorkflowCategory = 'Leads' | 'Messaging' | 'Deals' | 'Clients' | 'Sniper' | 'Team' | 'REX';

export interface WorkflowRecipe {
  id: number;
  title: string;
  trigger: string;
  actions: Array<{ endpoint: string; params?: Record<string, unknown> }>; 
  category: WorkflowCategory;
  description: string;
  recipeJSON?: Record<string, unknown>;
  icon: string; // emoji
  color: string; // tailwind color class hint (e.g., 'indigo', 'purple')
  tools?: string[];
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  setupTime?: string; // e.g., "~5 minutes"
  setupSteps?: string[];
}

const cat = {
  Leads: { icon: '🧠', color: 'indigo' },
  Messaging: { icon: '💬', color: 'purple' },
  Deals: { icon: '📈', color: 'green' },
  Clients: { icon: '🤝', color: 'teal' },
  Sniper: { icon: '🎯', color: 'red' },
  Team: { icon: '👥', color: 'amber' },
  REX: { icon: '🤖', color: 'indigo' },
} as const;

export const workflowLibrary: WorkflowRecipe[] = [
  // 1
  {
    id: 1,
    title: 'Apollo Lead Added → Auto-Enrich + Tag “Warm”',
    trigger: 'lead_source_added',
    actions: [
      { endpoint: '/api/leads/:id/enrich' },
      { endpoint: '/api/leads/:id', params: { tags: ['warm'] } },
    ],
    category: 'Leads',
    description: 'When a lead is sourced from Apollo, enrich and tag automatically.',
    tools: ['HirePilot', 'Apollo'],
    difficulty: 'Beginner',
    setupTime: '~5 minutes',
    setupSteps: [
      'Connect Apollo as a source in HirePilot (Settings → Integrations).',
      'Enable the trigger: lead_source_added and filter source = apollo.',
      'Map enrichment fields (name, title, company, email).',
      'Add auto-tag rule: warm.',
      'Create a test Apollo lead to verify enrichment + tag.',
    ],
    recipeJSON: {
      name: 'Apollo Lead → Enrich + Tag',
      trigger: 'lead_source_added',
      filter: { source: 'apollo' },
      actions: [
        { endpoint: '/api/leads/:id/enrich' },
        { endpoint: '/api/leads/:id', params: { tags: ['warm'] } },
      ],
    },
    icon: cat.Leads.icon,
    color: cat.Leads.color,
  },
  // 2
  {
    id: 2,
    title: 'Lead Tagged “VIP” → Send Personalized Message Sequence',
    trigger: 'lead_tag_added',
    actions: [
      { endpoint: '/api/messages/bulk-schedule', params: { template_id: 'vip_intro' } },
    ],
    category: 'Messaging',
    description: 'When a lead becomes VIP, launch a custom email sequence.',
    tools: ['HirePilot', 'SendGrid'],
    difficulty: 'Beginner',
    setupTime: '~5 minutes',
    setupSteps: [
      'Connect SendGrid (Settings → Integrations).',
      'Create or select the template "vip_intro" in Messaging.',
      'Enable trigger: lead_tag_added with tag = vip.',
      'Schedule bulk sequence using template vip_intro.',
      'Tag a lead as VIP and confirm the scheduled messages.',
    ],
    recipeJSON: {
      name: 'VIP Lead → Message Sequence',
      trigger: 'lead_tag_added',
      filter: { tag: 'vip' },
      actions: [
        { endpoint: '/api/messages/bulk-schedule', params: { template_id: 'vip_intro' } },
      ],
    },
    icon: cat.Messaging.icon,
    color: cat.Messaging.color,
  },
  // 3
  {
    id: 3,
    title: 'LinkedIn Lead Captured → Enrich + Notify Recruiter',
    trigger: 'lead_source_added',
    actions: [
      { endpoint: '/api/leads/:id/enrich' },
      { endpoint: '/api/notifications', params: { message: 'New LinkedIn lead enriched' } },
    ],
    category: 'Leads',
    description: 'Enrich LinkedIn leads and alert the recruiter via Slack.',
    tools: ['HirePilot', 'Slack', 'LinkedIn'],
    difficulty: 'Beginner',
    setupTime: '~6 minutes',
    setupSteps: [
      'Connect Slack and choose the notification channel (e.g., #leads).',
      'Enable trigger: lead_source_added with source = linkedin.',
      'Turn on /api/leads/:id/enrich to auto-enrich new leads.',
      'Post a Slack message confirming enrichment completed.',
      'Test by capturing a LinkedIn lead.',
    ],
    recipeJSON: {
      name: 'LinkedIn Lead → Enrich + Notify',
      trigger: 'lead_source_added',
      filter: { source: 'linkedin' },
      actions: [
        { endpoint: '/api/leads/:id/enrich' },
        { endpoint: '/api/notifications', params: { message: 'New LinkedIn lead enriched' } },
      ],
    },
    icon: cat.Leads.icon,
    color: cat.Leads.color,
  },
  // 4
  {
    id: 4,
    title: 'Skrapp Lead → Add to Cold Outreach Campaign',
    trigger: 'lead_source_added',
    actions: [
      { endpoint: '/api/sourcing/campaigns/:id/schedule', params: { campaign_id: 123 } },
    ],
    category: 'Messaging',
    description: 'Automatically launch outreach to fresh Skrapp leads.',
    tools: ['HirePilot', 'Skrapp'],
    difficulty: 'Beginner',
    setupTime: '~5 minutes',
    setupSteps: [
      'Connect Skrapp as a source in HirePilot.',
      'Create a Cold Outreach campaign and note its ID.',
      'Enable trigger: lead_source_added with source = skrapp.',
      'Schedule the campaign using the campaign ID.',
      'Add a sample Skrapp lead to verify scheduling.',
    ],
    recipeJSON: {
      name: 'Skrapp Lead → Cold Outreach',
      trigger: 'lead_source_added',
      filter: { source: 'skrapp' },
      actions: [
        { endpoint: '/api/sourcing/campaigns/:id/schedule', params: { campaign_id: 123 } },
      ],
    },
    icon: cat.Messaging.icon,
    color: cat.Messaging.color,
  },
  // 5
  {
    id: 5,
    title: 'Lead Enriched → Create Client Contact Automatically',
    trigger: 'lead_enriched',
    actions: [
      { endpoint: '/api/contacts', params: { name: '{{lead.name}}', email: '{{lead.email}}' } },
    ],
    category: 'Clients',
    description: 'Convert enriched leads into CRM-ready contacts.',
    tools: ['HirePilot'],
    difficulty: 'Beginner',
    setupTime: '~4 minutes',
    setupSteps: [
      'Enable trigger: lead_enriched.',
      'Configure /api/contacts to map name and email from the lead.',
      'Choose the destination client list/CRM segment.',
      'Run an enrichment job on a sample lead and confirm contact creation.',
    ],
    recipeJSON: {
      name: 'Lead Enriched → Create Contact',
      trigger: 'lead_enriched',
      actions: [
        { endpoint: '/api/contacts', params: { name: '{{lead.name}}', email: '{{lead.email}}' } },
      ],
    },
    icon: cat.Clients.icon,
    color: cat.Clients.color,
  },
  // 6
  { id: 6, title: 'Campaign Relaunched → Slack Team Update', trigger: 'campaign_relaunched', actions: [{ endpoint: '/api/notifications' }], category: 'Messaging', description: 'Alert your team when a campaign resumes.', icon: cat.Messaging.icon, color: cat.Messaging.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack and pick a channel.', 'Enable trigger: campaign_relaunched.', 'Send a test notification when relaunching a campaign.'] },
  // 7
  { id: 7, title: 'Reply Received → Candidate Record Updated', trigger: 'message_reply', actions: [{ endpoint: '/api/candidates/:id/enrich' }], category: 'Messaging', description: 'Sync replies into candidate profiles.', icon: cat.Messaging.icon, color: cat.Messaging.color, tools: ['HirePilot'], difficulty: 'Beginner', setupTime: '~4 minutes', setupSteps: ['Enable trigger: message_reply.', 'Map reply fields to candidate notes/enrichment.', 'Reply to a test message and confirm candidate updates.'] },
  // 8
  { id: 8, title: 'Sequence Scheduled → Log Activity + Notify', trigger: 'sequence_scheduled', actions: [{ endpoint: '/api/deals/activity' }, { endpoint: '/api/notifications' }], category: 'Messaging', description: 'Log sequence events and notify stakeholders.', icon: cat.Messaging.icon, color: cat.Messaging.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~5 minutes', setupSteps: ['Enable trigger: sequence_scheduled.', 'Log an activity to the related deal/opportunity.', 'Send a Slack notification to the team.', 'Schedule a sequence to test.'] },
  // 9
  { id: 9, title: 'Email Bounced → Tag Lead “Invalid”', trigger: 'email_bounced', actions: [{ endpoint: '/api/leads/:id', params: { tags: ['invalid'] } }], category: 'Messaging', description: 'Mark leads with bounced emails as invalid for future filtering.', icon: cat.Messaging.icon, color: cat.Messaging.color, tools: ['HirePilot', 'SendGrid'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect SendGrid.', 'Enable trigger: email_bounced.', 'Add tag rule: invalid.', 'Send a test to a bounce address to verify.'] },
  // 10
  { id: 10, title: 'Candidate Hired → Create Invoice', trigger: 'candidate_hired', actions: [{ endpoint: '/api/invoices/create' }], category: 'Deals', description: 'Automatically create an invoice when a candidate is hired.', icon: cat.Deals.icon, color: cat.Deals.color, tools: ['HirePilot', 'Stripe'], difficulty: 'Beginner', setupTime: '~5 minutes', setupSteps: ['Connect Stripe.', 'Enable trigger: candidate_hired.', 'Map invoice fields (amount, client, description).', 'Hire a test candidate to confirm invoice creation.'] },
  // 11
  { id: 11, title: 'Candidate Submitted → Slack Alert', trigger: 'opportunity_submitted', actions: [{ endpoint: '/api/notifications' }], category: 'Deals', description: 'Notify the team when a candidate is submitted to a client.', icon: cat.Deals.icon, color: cat.Deals.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: opportunity_submitted.', 'Send a Slack message with candidate + job info.', 'Submit a candidate to test.'] },
  // 12
  { id: 12, title: 'Application Created → Log Activity', trigger: 'opportunity_application_created', actions: [{ endpoint: '/api/deals/activity' }], category: 'Deals', description: 'Track new applications in your deal activity log.', icon: cat.Deals.icon, color: cat.Deals.color, tools: ['HirePilot'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Enable trigger: opportunity_application_created.', 'Append an activity entry linked to the opportunity.', 'Create a dummy application to test.'] },
  // 13
  { id: 13, title: 'Note Added → Send Slack Summary', trigger: 'opportunity_note_added', actions: [{ endpoint: '/api/notifications' }], category: 'Deals', description: 'Post a quick Slack summary when notes are added.', icon: cat.Deals.icon, color: cat.Deals.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: opportunity_note_added.', 'Compose Slack message with author + snippet.', 'Add a note to verify.'] },
  // 14
  { id: 14, title: 'Collaborator Added → Invite to Team', trigger: 'opportunity_collaborator_added', actions: [{ endpoint: '/api/team/invite' }], category: 'Team', description: 'Invite collaborators into your workspace automatically.', icon: cat.Team.icon, color: cat.Team.color, tools: ['HirePilot'], difficulty: 'Beginner', setupTime: '~4 minutes', setupSteps: ['Enable trigger: opportunity_collaborator_added.', 'Call /api/team/invite for the collaborator email.', 'Add a collaborator to a job to test.'] },
  // 15
  { id: 15, title: 'Client Created → Enrich Profile', trigger: 'client_created', actions: [{ endpoint: '/api/clients/:id/sync-enrichment' }], category: 'Clients', description: 'Auto-enrich new clients for better records.', icon: cat.Clients.icon, color: cat.Clients.color, tools: ['HirePilot'], difficulty: 'Beginner', setupTime: '~4 minutes', setupSteps: ['Enable trigger: client_created.', 'Map fields for enrichment sync.', 'Create a dummy client to confirm enrichment.'] },
  // 16
  { id: 16, title: 'Client Enriched → Notify AM', trigger: 'client_enriched', actions: [{ endpoint: '/api/notifications' }], category: 'Clients', description: 'Alert account managers when client enrichment completes.', icon: cat.Clients.icon, color: cat.Clients.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: client_enriched.', 'Notify the AM Slack channel with client highlights.', 'Run enrichment to test.'] },
  // 17
  { id: 17, title: 'Contact Added → Log CRM Activity', trigger: 'contact_created', actions: [{ endpoint: '/api/deals/activity' }], category: 'Clients', description: 'Capture contact creation as a CRM activity.', icon: cat.Clients.icon, color: cat.Clients.color, tools: ['HirePilot'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Enable trigger: contact_created.', 'Create activity record associated to the client/deal.', 'Add a contact to test.'] },
  // 18
  { id: 18, title: 'New Target Added → Capture Now', trigger: 'sniper_target_added', actions: [{ endpoint: '/api/sniper/targets/:id/capture-now' }], category: 'Sniper', description: 'Immediately capture when a new Sniper target is added.', icon: cat.Sniper.icon, color: cat.Sniper.color, tools: ['HirePilot', 'Sniper'], difficulty: 'Intermediate', setupTime: '~6 minutes', setupSteps: ['Enable trigger: sniper_target_added.', 'Configure capture-now parameters/limits.', 'Add a Sniper target to test.'] },
  // 19
  { id: 19, title: 'Capture Complete → Create New Lead', trigger: 'sniper_capture_complete', actions: [{ endpoint: '/api/leads' }], category: 'Sniper', description: 'Create a lead after Sniper finishes capturing.', icon: cat.Sniper.icon, color: cat.Sniper.color, tools: ['HirePilot', 'Sniper'], difficulty: 'Intermediate', setupTime: '~5 minutes', setupSteps: ['Enable trigger: sniper_capture_complete.', 'Map captured data to lead fields.', 'Run a capture job to verify lead creation.'] },
  // 20
  { id: 20, title: 'Capture Started → Slack Alert', trigger: 'sniper_capture_started', actions: [{ endpoint: '/api/notifications' }], category: 'Sniper', description: 'Notify your team when a capture run starts.', icon: cat.Sniper.icon, color: cat.Sniper.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: sniper_capture_started.', 'Send Slack alert with target count.'] },
  // 21
  { id: 21, title: 'Team Invite Sent → Welcome Message', trigger: 'team_invite_sent', actions: [{ endpoint: '/api/notifications' }], category: 'Team', description: 'Send a welcome blurb when you invite a teammate.', icon: cat.Team.icon, color: cat.Team.color, tools: ['HirePilot', 'Slack'], difficulty: 'Beginner', setupTime: '~3 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: team_invite_sent.', 'Send a welcome message with key links.'] },
  // 22
  { id: 22, title: 'Role Updated → Sync Permissions', trigger: 'team_role_updated', actions: [{ endpoint: '/api/team/member/:id/role' }], category: 'Team', description: 'Keep permissions consistent when roles change.', icon: cat.Team.icon, color: cat.Team.color, tools: ['HirePilot'], difficulty: 'Intermediate', setupTime: '~5 minutes', setupSteps: ['Enable trigger: team_role_updated.', 'Map roles to permission sets.', 'Update a member role to confirm syncing.'] },
  // 23
  { id: 23, title: 'Notification Created → Trigger REX Summary', trigger: 'notification_created', actions: [{ endpoint: '/api/rex/tools/rex_chat' }], category: 'REX', description: 'Use REX to summarize fresh notifications.', icon: cat.REX.icon, color: cat.REX.color, tools: ['HirePilot', 'REX'], difficulty: 'Intermediate', setupTime: '~6 minutes', setupSteps: ['Enable trigger: notification_created.', 'Pass notification payload to REX chat summarizer.', 'Verify summarized output appears in activity.'] },
  // 24
  { id: 24, title: 'User Command → Auto-Generate Workflow', trigger: 'rex_chat_triggered', actions: [{ endpoint: '/api/rex/tools/workflows/create_workflow' }], category: 'REX', description: 'Generate workflows dynamically from REX commands.', icon: cat.REX.icon, color: cat.REX.color, tools: ['HirePilot', 'REX'], difficulty: 'Advanced', setupTime: '~10 minutes', setupSteps: ['Enable trigger: rex_chat_triggered.', 'Map intents to workflow blueprints.', 'Confirm a REX command generates a draft workflow.'] },
  // 25
  { id: 25, title: 'REX Chat Summary → Send Report', trigger: 'rex_chat_completed', actions: [{ endpoint: '/api/notifications' }], category: 'REX', description: 'Send a summarized report when a REX chat ends.', icon: cat.REX.icon, color: cat.REX.color, tools: ['HirePilot', 'Slack', 'REX'], difficulty: 'Beginner', setupTime: '~4 minutes', setupSteps: ['Connect Slack.', 'Enable trigger: rex_chat_completed.', 'Send a final report to Slack or email.', 'Run a chat and confirm the report.'] },
];

export default workflowLibrary;


