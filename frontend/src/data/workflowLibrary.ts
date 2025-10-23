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
  { id: 6, title: 'Campaign Relaunched → Slack Team Update', trigger: 'campaign_relaunched', actions: [{ endpoint: '/api/notifications' }], category: 'Messaging', description: 'Alert your team when a campaign resumes.', icon: cat.Messaging.icon, color: cat.Messaging.color },
  // 7
  { id: 7, title: 'Reply Received → Candidate Record Updated', trigger: 'message_reply', actions: [{ endpoint: '/api/candidates/:id/enrich' }], category: 'Messaging', description: 'Sync replies into candidate profiles.', icon: cat.Messaging.icon, color: cat.Messaging.color },
  // 8
  { id: 8, title: 'Sequence Scheduled → Log Activity + Notify', trigger: 'sequence_scheduled', actions: [{ endpoint: '/api/deals/activity' }, { endpoint: '/api/notifications' }], category: 'Messaging', description: 'Log sequence events and notify stakeholders.', icon: cat.Messaging.icon, color: cat.Messaging.color },
  // 9
  { id: 9, title: 'Email Bounced → Tag Lead “Invalid”', trigger: 'email_bounced', actions: [{ endpoint: '/api/leads/:id', params: { tags: ['invalid'] } }], category: 'Messaging', description: 'Mark leads with bounced emails as invalid for future filtering.', icon: cat.Messaging.icon, color: cat.Messaging.color },
  // 10
  { id: 10, title: 'Candidate Hired → Create Invoice', trigger: 'candidate_hired', actions: [{ endpoint: '/api/invoices/create' }], category: 'Deals', description: 'Automatically create an invoice when a candidate is hired.', icon: cat.Deals.icon, color: cat.Deals.color },
  // 11
  { id: 11, title: 'Candidate Submitted → Slack Alert', trigger: 'opportunity_submitted', actions: [{ endpoint: '/api/notifications' }], category: 'Deals', description: 'Notify the team when a candidate is submitted to a client.', icon: cat.Deals.icon, color: cat.Deals.color },
  // 12
  { id: 12, title: 'Application Created → Log Activity', trigger: 'opportunity_application_created', actions: [{ endpoint: '/api/deals/activity' }], category: 'Deals', description: 'Track new applications in your deal activity log.', icon: cat.Deals.icon, color: cat.Deals.color },
  // 13
  { id: 13, title: 'Note Added → Send Slack Summary', trigger: 'opportunity_note_added', actions: [{ endpoint: '/api/notifications' }], category: 'Deals', description: 'Post a quick Slack summary when notes are added.', icon: cat.Deals.icon, color: cat.Deals.color },
  // 14
  { id: 14, title: 'Collaborator Added → Invite to Team', trigger: 'opportunity_collaborator_added', actions: [{ endpoint: '/api/team/invite' }], category: 'Team', description: 'Invite collaborators into your workspace automatically.', icon: cat.Team.icon, color: cat.Team.color },
  // 15
  { id: 15, title: 'Client Created → Enrich Profile', trigger: 'client_created', actions: [{ endpoint: '/api/clients/:id/sync-enrichment' }], category: 'Clients', description: 'Auto-enrich new clients for better records.', icon: cat.Clients.icon, color: cat.Clients.color },
  // 16
  { id: 16, title: 'Client Enriched → Notify AM', trigger: 'client_enriched', actions: [{ endpoint: '/api/notifications' }], category: 'Clients', description: 'Alert account managers when client enrichment completes.', icon: cat.Clients.icon, color: cat.Clients.color },
  // 17
  { id: 17, title: 'Contact Added → Log CRM Activity', trigger: 'contact_created', actions: [{ endpoint: '/api/deals/activity' }], category: 'Clients', description: 'Capture contact creation as a CRM activity.', icon: cat.Clients.icon, color: cat.Clients.color },
  // 18
  { id: 18, title: 'New Target Added → Capture Now', trigger: 'sniper_target_added', actions: [{ endpoint: '/api/sniper/targets/:id/capture-now' }], category: 'Sniper', description: 'Immediately capture when a new Sniper target is added.', icon: cat.Sniper.icon, color: cat.Sniper.color },
  // 19
  { id: 19, title: 'Capture Complete → Create New Lead', trigger: 'sniper_capture_complete', actions: [{ endpoint: '/api/leads' }], category: 'Sniper', description: 'Create a lead after Sniper finishes capturing.', icon: cat.Sniper.icon, color: cat.Sniper.color },
  // 20
  { id: 20, title: 'Capture Started → Slack Alert', trigger: 'sniper_capture_started', actions: [{ endpoint: '/api/notifications' }], category: 'Sniper', description: 'Notify your team when a capture run starts.', icon: cat.Sniper.icon, color: cat.Sniper.color },
  // 21
  { id: 21, title: 'Team Invite Sent → Welcome Message', trigger: 'team_invite_sent', actions: [{ endpoint: '/api/notifications' }], category: 'Team', description: 'Send a welcome blurb when you invite a teammate.', icon: cat.Team.icon, color: cat.Team.color },
  // 22
  { id: 22, title: 'Role Updated → Sync Permissions', trigger: 'team_role_updated', actions: [{ endpoint: '/api/team/member/:id/role' }], category: 'Team', description: 'Keep permissions consistent when roles change.', icon: cat.Team.icon, color: cat.Team.color },
  // 23
  { id: 23, title: 'Notification Created → Trigger REX Summary', trigger: 'notification_created', actions: [{ endpoint: '/api/rex/tools/rex_chat' }], category: 'REX', description: 'Use REX to summarize fresh notifications.', icon: cat.REX.icon, color: cat.REX.color },
  // 24
  { id: 24, title: 'User Command → Auto-Generate Workflow', trigger: 'rex_chat_triggered', actions: [{ endpoint: '/api/rex/tools/workflows/create_workflow' }], category: 'REX', description: 'Generate workflows dynamically from REX commands.', icon: cat.REX.icon, color: cat.REX.color },
  // 25
  { id: 25, title: 'REX Chat Summary → Send Report', trigger: 'rex_chat_completed', actions: [{ endpoint: '/api/notifications' }], category: 'REX', description: 'Send a summarized report when a REX chat ends.', icon: cat.REX.icon, color: cat.REX.color },
];

export default workflowLibrary;


