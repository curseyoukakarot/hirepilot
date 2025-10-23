// Minimal per-node schema registry (guided + developer defaults)
// Keyed by endpoint slug (last segment after last '/')

export type NodeSchema = {
  guided?: {
    name?: string;
    channel?: string;
    template?: string;
    fields?: string[];
  };
  developer?: {
    endpoint?: string;
    method?: string;
    defaultBody?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
};

export const nodeSchemas: Record<string, NodeSchema> = {
  candidate_hired: {
    guided: {
      channel: '#hiring-alerts',
      template: '🎉 {{candidate.name}} hired for {{job.title}}!',
      fields: ['candidate.name', 'job.title', 'job.department', 'deal.value']
    },
    developer: {
      endpoint: '/api/events/candidate_hired',
      method: 'POST',
      defaultBody: { text: '🎉 {{candidate.name}} hired for {{job.title}}!' }
    }
  },
  lead_tagged: {
    guided: {
      channel: '#hiring-alerts',
      template: '⚡ {{candidate.name}} → {{job.title}}',
      fields: ['lead.tag', 'candidate.name', 'job.title']
    },
    developer: {
      endpoint: '/api/events/lead_tagged',
      method: 'POST',
      defaultBody: { text: '🏷️ {{candidate.name}} tagged as {{lead.tag}}' }
    }
  },
  lead_created: {
    guided: {
      channel: '#leads',
      template: '🆕 New lead: {{candidate.name}} ({{lead.source}})'
    },
    developer: { endpoint: '/api/events/lead_created', method: 'POST' }
  },
  lead_source_triggered: {
    guided: { channel: '#leads', template: '🔗 Source: {{lead.source}} – {{candidate.name}}' },
    developer: { endpoint: '/api/events/lead_source_triggered', method: 'POST' }
  },
  campaign_relaunched: {
    guided: { channel: '#campaigns', template: '🚀 Campaign relaunched – auditing sequences' },
    developer: { endpoint: '/api/events/campaign_relaunched', method: 'POST' }
  },
  candidate_updated: {
    guided: { channel: '#updates', template: '📝 {{candidate.name}} updated (syncing records)' },
    developer: { endpoint: '/api/events/candidate_updated', method: 'POST' }
  },
  pipeline_stage_updated: {
    guided: { channel: '#pipeline', template: '🔄 {{candidate.name}} moved to {{pipeline.stage}}' },
    developer: { endpoint: '/api/events/pipeline_stage_updated', method: 'POST' }
  },
  client_created: {
    guided: { channel: '#clients', template: '🏢 New client: {{client.name}}' },
    developer: { endpoint: '/api/events/client_created', method: 'POST' }
  },
  client_updated: {
    guided: { channel: '#clients', template: '♻️ Client updated: {{client.name}}' },
    developer: { endpoint: '/api/events/client_updated', method: 'POST' }
  },
  job_created: {
    guided: { channel: '#jobs', template: '📄 New role opened – {{job.title}}' },
    developer: { endpoint: '/api/events/job_created', method: 'POST' }
  },
  // Actions
  send_email_template: {
    guided: { channel: '#general', template: '📧 Emailing {{candidate.name}} re: {{job.title}}' },
    developer: { endpoint: '/api/actions/send_email_template', method: 'POST' }
  },
  notifications: {
    guided: { channel: '#alerts', template: '🔔 Update: {{candidate.name}} – {{job.title}}' },
    developer: { endpoint: '/api/actions/notifications', method: 'POST' }
  },
  sync_enrichment: {
    guided: { channel: '#enrichment', template: '🧠 Enriching {{candidate.name}}' },
    developer: { endpoint: '/api/actions/sync_enrichment', method: 'POST' }
  },
  create_client: {
    guided: { channel: '#clients', template: '🤝 Create client {{client.name}}' },
    developer: { endpoint: '/api/actions/create_client', method: 'POST' }
  },
  invoices_create: {
    guided: { channel: '#billing', template: '💸 Invoice generated for {{client.name}}' },
    developer: { endpoint: '/api/actions/invoices_create', method: 'POST' }
  },
  add_note: {
    guided: { channel: '#pipeline', template: '📝 Note added for {{candidate.name}}' },
    developer: { endpoint: '/api/actions/add_note', method: 'POST' }
  },
  add_collaborator: {
    guided: { channel: '#team', template: '👥 Invited collaborator to {{job.title}}' },
    developer: { endpoint: '/api/actions/add_collaborator', method: 'POST' }
  },
  update_pipeline_stage: {
    guided: { channel: '#pipeline', template: '➡️ Moving {{candidate.name}} to next stage' },
    developer: { endpoint: '/api/actions/update_pipeline_stage', method: 'POST' }
  },
  rex_chat: {
    guided: { channel: '#general', template: '🤖 REX: {{prompt}}' },
    developer: { endpoint: '/api/actions/rex_chat', method: 'POST' }
  }
};

export function getSchemaForEndpoint(endpoint?: string) {
  if (!endpoint) return undefined;
  const slug = String(endpoint).split('/').filter(Boolean).pop() || '';
  return nodeSchemas[slug];
}


