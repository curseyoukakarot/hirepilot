export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { endpoint, type } = req.query || {};
  const ep = String(endpoint || '').toLowerCase();
  // Global tokens
  const base = [
    'candidate.id', 'candidate.name', 'candidate.email', 'candidate.phone',
    'job.id', 'job.title', 'job.department', 'job.location',
    'client.id', 'client.name', 'user.id', 'user.email'
  ];
  const common = {
    pipeline: ['pipeline.id', 'pipeline.stage', 'pipeline.prev_stage', 'pipeline.changed_at'],
    campaign: ['campaign.id', 'campaign.name'],
    tags: ['tag.id', 'tag.name', 'tag.slug'],
    source: ['lead.source', 'lead.source_ref'],
    crm: ['client.owner', 'client.domain'],
    job: ['job.seniority', 'job.type'],
    messaging: ['message.id', 'message.subject', 'message.body', 'channel', 'thread_ts'],
    deals: ['deal.id', 'deal.amount', 'deal.status'],
    billing: ['invoice.id', 'invoice.amount', 'invoice.currency'],
    enrichment: ['provider', 'credit_cost']
  } as const;

  // Per-endpoint field extensions
  const map: Array<{ match: RegExp; extra: string[] }> = [
    { match: /\/api\/events\/lead_created/, extra: [...common.source] },
    { match: /\/api\/events\/lead_tagged/, extra: [...common.tags] },
    { match: /\/api\/events\/lead_source_triggered/, extra: [...common.source] },
    { match: /\/api\/events\/campaign_relaunched/, extra: [...common.campaign] },
    { match: /\/api\/events\/candidate_hired/, extra: [...common.deals, ...common.billing] },
    { match: /\/api\/events\/candidate_updated/, extra: ['candidate.updated_fields'] },
    { match: /\/api\/events\/pipeline_stage_updated/, extra: [...common.pipeline] },
    { match: /\/api\/events\/client_created/, extra: [...common.crm] },
    { match: /\/api\/events\/client_updated/, extra: [...common.crm] },
    { match: /\/api\/events\/job_created/, extra: [...common.job] },
    { match: /\/api\/zapier\/triggers\/events/, extra: ['event.type', 'event.payload'] },

    // Actions
    { match: /\/api\/actions\/submit_to_client/, extra: [...common.deals, 'submission.url'] },
    { match: /\/api\/actions\/bulk_schedule/, extra: [...common.messaging, 'sequence.id'] },
    { match: /\/api\/actions\/send_email_template/, extra: ['template.id', 'template.vars.*'] },
    { match: /\/api\/actions\/notifications/, extra: [...common.messaging] },
    { match: /\/api\/actions\/sync_enrichment/, extra: [...common.enrichment] },
    { match: /\/api\/actions\/create_client/, extra: [...common.crm] },
    { match: /\/api\/actions\/invoices_create/, extra: [...common.billing, ...common.deals] },
    { match: /\/api\/actions\/add_note/, extra: ['note.text'] },
    { match: /\/api\/actions\/add_collaborator/, extra: ['collaborator.email', 'collaborator.role'] },
    { match: /\/api\/actions\/update_pipeline_stage/, extra: [...common.pipeline, 'pipeline.new_stage'] },
    { match: /\/api\/actions\/rex_chat/, extra: ['prompt', 'mode'] }
  ];

  let fields = [...base];
  for (const m of map) {
    if (m.match.test(ep)) { fields = [...fields, ...m.extra]; break; }
  }

  return res.status(200).json({ fields });
}


