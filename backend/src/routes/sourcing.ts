console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { createCampaign, addLeads, generateSequenceForCampaign, scheduleCampaign } from '../services/sourcing';
import { getCampaignWithDetails, getLeadsForCampaign, searchCampaigns, getCampaignStats } from '../services/sourcingUtils';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { ApiRequest } from '../../types/api';
import { sendTieredTemplateToCampaign, generateAndSendNewSequenceToCampaign, sendSingleMessageToCampaign } from '../services/messagingCampaign';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import { applyWorkspaceScope, WORKSPACES_ENFORCE_STRICT } from '../lib/workspaceScope';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

// Debug logging for route registration
console.log('Registering sourcing routes...');

const scoped = (req: Request, table: string, ownerColumn: string = 'user_id') =>
  applyWorkspaceScope(supabase.from(table), {
    workspaceId: (req as any).workspaceId,
    userId: (req as any)?.user?.id,
    ownerColumn
  });

const scopedNoOwner = (req: Request, table: string) => {
  const base: any = supabase.from(table);
  const workspaceId = (req as any).workspaceId;
  if (!workspaceId) return base;
  if (WORKSPACES_ENFORCE_STRICT) return base.eq('workspace_id', workspaceId);
  return base.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
};

// Create new campaign
router.post('/campaigns', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const body = z.object({
      title: z.string().min(3),
      audience_tag: z.string().optional(),
      sender_id: z.string().uuid().optional(),
      created_by: z.string().optional()
    }).parse(req.body);
    
    // Use authenticated user ID if not provided
    const campaignData = {
      title: body.title,
      audience_tag: body.audience_tag,
      sender_id: body.sender_id,
      created_by: body.created_by || req.user?.id
    };
    
    const campaign = await createCampaign(campaignData, (req as any).workspaceId);
    return res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Generate sequence for campaign
router.post('/campaigns/:id/sequence', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({
      title_groups: z.array(z.string()).min(1),
      industry: z.string().optional(),
      product_name: z.string().default('HirePilot'),
      spacing_business_days: z.number().int().min(1).max(5).default(2)
    }).parse(req.body);
    
    const sequenceParams = {
      title_groups: body.title_groups,
      industry: body.industry,
      product_name: body.product_name,
      spacing_business_days: body.spacing_business_days
    };
    
    const sequence = await generateSequenceForCampaign(id, sequenceParams);
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.sequence_scheduled,
        user_id: req.user!.id,
        entity: 'campaign',
        entity_id: id,
        payload: { sequenceId: (sequence as any)?.id || null }
      });
    } catch {}
    return res.json(sequence);
  } catch (error: any) {
    console.error('Error generating sequence:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Add leads to campaign
router.post('/campaigns/:id/leads', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({
      leads: z.array(z.object({
        name: z.string().optional(),
        title: z.string().optional(),
        company: z.string().optional(),
        linkedin_url: z.string().url().optional(),
        email: z.string().email().optional(),
        domain: z.string().optional()
      })),
      source: z.enum(['apollo','linkedin']).optional()
    }).parse(req.body);
    
    const result = await addLeads(id, body.leads, {
      source: body.source,
      userId: req.user?.id,
      workspaceId: (req as any).workspaceId
    });
    return res.json(result);
  } catch (error: any) {
    console.error('Error adding leads:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Schedule campaign
router.post('/campaigns/:id/schedule', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await scheduleCampaign(id);
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.sequence_scheduled,
        user_id: req.user!.id,
        entity: 'campaign',
        entity_id: id,
        payload: { scheduled: true }
      });
    } catch {}
    return res.json(result);
  } catch (error: any) {
    console.error('Error scheduling campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get campaign with details
router.get('/campaigns/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const full = await getCampaignWithDetails(id, (req as any).workspaceId, req.user?.id || null);
    const leads = await getLeadsForCampaign(id, 200, 0, (req as any).workspaceId);

    const campaign = {
      id: full.id,
      title: full.title,
      audience_tag: (full as any).audience_tag,
      status: full.status,
      created_at: full.created_at,
      created_by: (full as any).created_by,
      default_sender_id: (full as any).default_sender_id
    } as any;

    const sequence = Array.isArray((full as any).sourcing_sequences) && (full as any).sourcing_sequences.length > 0
      ? (full as any).sourcing_sequences[0]
      : undefined;

    return res.json({ campaign, sequence, leads });
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    return res.status(404).json({ error: 'Campaign not found' });
  }
});

// Campaign stats (used by campaigns listing)
router.get('/campaigns/:id/stats', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const stats = await getCampaignStats(id, (req as any).workspaceId);
    // Map to the structure the frontend expects on CampaignsPage
    const mapped = {
      total_leads: stats.total,
      emails_sent: (stats.step1_sent + stats.step2_sent + stats.step3_sent),
      replies_received: stats.replied,
      positive_replies: stats.positive_replies
    };
    const emit = String(req.query.emit || 'false') === 'true';
    if (emit && req.user?.id) {
      try {
        await createZapEvent({
          event_type: EVENT_TYPES.campaign_stats_snapshot,
          user_id: req.user.id,
          entity: 'campaign',
          entity_id: id,
          payload: mapped
        });
      } catch {}
    }
    return res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching campaign stats:', error);
    return res.status(404).json({ error: 'Stats not found' });
  }
});

// Get leads for campaign
router.get('/campaigns/:id/leads', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const leads = await getLeadsForCampaign(id, limit, offset, (req as any).workspaceId);
    return res.json({ leads, limit, offset });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Backfill replies into sourcing_replies for an existing campaign.
// This is useful when replies were captured via the generic inbound pipeline (email_replies)
// before sourcing mirroring was deployed.
router.post('/campaigns/:id/backfill-replies', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id: campaignId } = req.params;
    const limit = Math.min(parseInt(String((req.query as any)?.limit || '500'), 10) || 500, 2000);
    const days = Math.min(parseInt(String((req.query as any)?.days || '30'), 10) || 30, 180);

    const { data: campaign } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .select('id, created_by, created_at')
      .eq('id', campaignId)
      .maybeSingle();
    if (!campaign?.id) return res.status(404).json({ error: 'campaign_not_found' });

    // Permission: campaign owner OR super_admin
    const meRole = String((req.user as any)?.role || '').toLowerCase();
    const isSuper = ['super_admin', 'superadmin'].includes(meRole);
    if (!isSuper && String(campaign.created_by || '') !== String(req.user?.id || '')) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent replies for this user.
    // Prefer strict matching on raw.to containing ".c_<campaignId>", but also allow
    // fallback matching by from_email against sourcing_leads in this campaign (older replies
    // may not have had campaign-id encoded in Reply-To).
    const { data: replies } = await supabase
      .from('email_replies')
      .select('id, user_id, from_email, subject, text_body, html_body, raw, reply_ts')
      .eq('user_id', campaign.created_by as any)
      .gte('reply_ts', sinceIso)
      .order('reply_ts', { ascending: false })
      .limit(limit);

    const normalizeEmail = (v: any) => {
      const raw = String(v || '').trim();
      const m = raw.match(/<([^>]+)>/);
      const addr = (m ? m[1] : raw).trim().replace(/^"+|"+$/g, '');
      return addr ? addr.toLowerCase() : '';
    };

    const looksLikeUuid = (v: string) => /^[0-9a-fA-F-]{36}$/.test(v);
    const parseToForLead = (toVal: any) => {
      const to = String(toVal || '');
      const m = to.match(/\.c_([0-9a-fA-F-]+)\.l_([0-9a-fA-F-]+|none)@/i);
      if (!m) return { campaign: null, lead: null };
      return { campaign: m[1], lead: (m[2] && m[2].toLowerCase() !== 'none') ? m[2] : null };
    };

    let scanned = 0;
    let inserted = 0;
    let skipped = 0;

    for (const r of replies || []) {
      scanned += 1;
      const raw = (r as any).raw || {};
      const toRaw = raw?.to || raw?.envelope_to || raw?.to_raw || '';
      const parsed = parseToForLead(toRaw);
      const matchesCampaignInTo =
        !!parsed?.campaign && String(parsed.campaign).toLowerCase() === String(campaignId).toLowerCase();

      let sourcingLeadId: string | null = null;
      // Prefer explicit sourcing lead id from to-address
      if (matchesCampaignInTo && parsed.lead && looksLikeUuid(parsed.lead)) {
        sourcingLeadId = parsed.lead;
      }

      // Otherwise resolve by email within this sourcing campaign
      if (!sourcingLeadId) {
        const fromEmail = normalizeEmail((r as any).from_email);
        if (!fromEmail) { skipped += 1; continue; }
        const { data: sl } = await scoped(req, 'sourcing_leads')
          .select('id')
          .eq('campaign_id', campaignId as any)
          .ilike('email', fromEmail)
          .maybeSingle();
        if (sl?.id) sourcingLeadId = sl.id;
      }
      // If it doesn't match campaign by to-address and we couldn't match by email, skip.
      if (!matchesCampaignInTo && !sourcingLeadId) { skipped += 1; continue; }
      if (!sourcingLeadId) { skipped += 1; continue; }

      const receivedAt = (r as any).reply_ts || new Date().toISOString();

      // Dedupe: skip if we already have a sourcing reply at the same timestamp for this lead
      const { data: existing } = await scoped(req, 'sourcing_replies')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('lead_id', sourcingLeadId as any)
        .eq('received_at', receivedAt)
        .limit(1);
      if (existing && existing.length > 0) { skipped += 1; continue; }

      const body = String((r as any).text_body || (r as any).html_body || '');
      const { error: insErr } = await scoped(req, 'sourcing_replies')
        .insert({
          campaign_id: campaignId,
          lead_id: sourcingLeadId,
          direction: 'inbound',
          subject: (r as any).subject || null,
          body,
          email_from: (r as any).from_email || null,
          email_to: toRaw || null,
          received_at: receivedAt
        });
      if (insErr) {
        skipped += 1;
        continue;
      }
      inserted += 1;

      // Update sourcing lead state for stats
      await scoped(req, 'sourcing_leads')
        .update({ outreach_stage: 'replied', reply_status: 'replied' })
        .eq('id', sourcingLeadId as any);
    }

    return res.json({ ok: true, campaignId, scanned, inserted, skipped, since: sinceIso });
  } catch (error: any) {
    console.error('Error backfilling sourcing replies:', error);
    return res.status(500).json({ error: error?.message || 'backfill_failed' });
  }
});

// List/Search campaigns - handles both simple list and search
router.get('/campaigns', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    // If no query parameters, return simple list for frontend
    if (Object.keys(req.query).length === 0) {
      const userId = req.user?.id as string;
      const { data, error } = await scoped(req, 'sourcing_campaigns', 'created_by')
        .select('id, title, audience_tag, status, created_at, created_by, default_sender_id')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        throw new Error(`Failed to fetch campaigns: ${error.message}`);
      }
      
      return res.json(data || []);
    }
    
    // Otherwise, use search functionality
    const filters = {
      status: req.query.status as string,
      created_by: req.query.created_by as string || req.user?.id, // Default to user's campaigns
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };
    
    const campaigns = await searchCampaigns(filters, (req as any).workspaceId);
    return res.json({ campaigns, ...filters });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Save campaign sender behavior config
router.post('/campaign-config/:id/sender', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({
      senderBehavior: z.enum(['single','rotate','specific']),
      senderEmail: z.string().email().optional(),
      senderEmails: z.array(z.string().email()).optional()
    }).parse(req.body);

    if (body.senderBehavior === 'single' && !body.senderEmail) {
      return res.status(400).json({ error: 'senderEmail required for single behavior' });
    }

    const userId = req.user?.id as string;
    const { data: available } = await supabase
      .from('user_sendgrid_senders')
      .select('email,verified')
      .eq('user_id', userId);
    const allowed = new Set((available || []).filter(s => s.verified).map(s => s.email));

    if (body.senderBehavior === 'single' && body.senderEmail && !allowed.has(body.senderEmail)) {
      return res.status(400).json({ error: 'Sender email not found/verified for this account' });
    }
    if (body.senderBehavior === 'specific' && body.senderEmails) {
      const invalid = body.senderEmails.filter(e => !allowed.has(e));
      if (invalid.length) return res.status(400).json({ error: `Invalid senders: ${invalid.join(', ')}` });
    }

    const { error } = await supabase
      .from('campaign_configs')
      .upsert({
        campaign_id: id,
        sender_behavior: body.senderBehavior,
        sender_email: body.senderEmail || null,
        sender_emails: body.senderBehavior === 'specific' ? (body.senderEmails || []) : null,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Error saving campaign sender config:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get campaign config (sender behavior + auto outreach)
router.get('/campaign-config/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id as string;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data: campaign } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .select('id, created_by')
      .eq('id', id)
      .maybeSingle();
    if (!campaign?.id) return res.status(404).json({ error: 'campaign_not_found' });

    const meRole = String((req.user as any)?.role || '').toLowerCase();
    const isSuper = ['super_admin', 'superadmin'].includes(meRole);
    if (!isSuper && String((campaign as any).created_by || '') !== String(userId)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { data: cfg } = await supabase
      .from('campaign_configs')
      .select('*')
      .eq('campaign_id', id)
      .maybeSingle();

    return res.json({
      campaign_id: id,
      sender_behavior: (cfg as any)?.sender_behavior || 'single',
      sender_email: (cfg as any)?.sender_email || null,
      sender_emails: (cfg as any)?.sender_emails || [],
      auto_outreach_enabled: (cfg as any)?.auto_outreach_enabled !== false
    });
  } catch (error: any) {
    console.error('Error fetching campaign config:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Toggle campaign-level auto outreach
router.post('/campaign-config/:id/auto-outreach', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({ enabled: z.boolean() }).parse(req.body);

    const userId = req.user?.id as string;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { data: campaign } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .select('id, created_by')
      .eq('id', id)
      .maybeSingle();
    if (!campaign?.id) return res.status(404).json({ error: 'campaign_not_found' });

    const meRole = String((req.user as any)?.role || '').toLowerCase();
    const isSuper = ['super_admin', 'superadmin'].includes(meRole);
    if (!isSuper && String((campaign as any).created_by || '') !== String(userId)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { error } = await supabase
      .from('campaign_configs')
      .upsert({
        campaign_id: id,
        auto_outreach_enabled: body.enabled,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;

    return res.json({ ok: true, auto_outreach_enabled: body.enabled });
  } catch (error: any) {
    console.error('Error toggling auto outreach:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get email senders
router.get('/senders', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { data: senders, error } = await supabase
      .from('user_sendgrid_senders')
      .select('email,name,verified')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    // normalize to previous frontend expectation
    const normalized = (senders || []).map(s => ({ id: s.email, from_email: s.email, from_name: s.name, domain_verified: s.verified }));
    return res.json(normalized);
  } catch (error: any) {
    console.error('Error fetching senders:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Create email sender
router.post('/senders', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const body = z.object({
      from_name: z.string().min(1),
      from_email: z.string().email(),
      provider: z.string().default('sendgrid'),
      domain_verified: z.boolean().default(false),
      warmup_mode: z.boolean().default(true),
      sendgrid_subuser: z.string().optional()
    }).parse(req.body);
    
    const { data: sender, error } = await supabase
      .from('email_senders')
      .insert(body)
      .select()
      .single();
    
    if (error) throw error;
    return res.status(201).json(sender);
  } catch (error: any) {
    console.error('Error creating sender:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get replies for campaign
router.get('/campaigns/:id/replies', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data: replies, error } = await scoped(req, 'sourcing_replies')
      .select(`
        *,
        sourcing_leads (
          id,
          name,
          title,
          company,
          email
        )
      `)
      .eq('campaign_id', id)
      .order('received_at', { ascending: false });
    
    if (error) throw error;
    return res.json({ replies });
  } catch (error: any) {
    console.error('Error fetching replies:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Reply actions
router.post('/replies/:replyId/book-demo', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { replyId } = req.params;
    const { lead_id } = req.body;
    
    // Update reply with action taken
    const { error: replyError } = await scoped(req, 'sourcing_replies')
      .update({ 
        next_action: 'book',
        classified_as: 'positive' 
      })
      .eq('id', replyId);
    
    if (replyError) throw replyError;
    
    // Update lead status
    const { error: leadError } = await scoped(req, 'sourcing_leads')
      .update({ 
        reply_status: 'positive',
        outreach_stage: 'replied'
      })
      .eq('id', lead_id);
    
    if (leadError) throw leadError;
    
    return res.json({ success: true, action: 'book_demo' });
  } catch (error: any) {
    console.error('Error booking demo:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/replies/:replyId/disqualify', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { replyId } = req.params;
    const { lead_id } = req.body;
    
    // Update reply with action taken
    const { error: replyError } = await scoped(req, 'sourcing_replies')
      .update({ 
        next_action: 'disqualify',
        classified_as: 'negative' 
      })
      .eq('id', replyId);
    
    if (replyError) throw replyError;
    
    // Update lead status
    const { error: leadError } = await scoped(req, 'sourcing_leads')
      .update({ 
        reply_status: 'negative',
        outreach_stage: 'unsubscribed'
      })
      .eq('id', lead_id);
    
    if (leadError) throw leadError;
    
    return res.json({ success: true, action: 'disqualify' });
  } catch (error: any) {
    console.error('Error disqualifying lead:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Campaign control actions
router.post('/campaigns/:id/pause', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .update({ status: 'paused' })
      .eq('id', id);
    
    if (error) throw error;
    try { await createZapEvent({ event_type: EVENT_TYPES.campaign_paused, user_id: req.user!.id, entity: 'campaign', entity_id: id, payload: { status: 'paused' } }); } catch {}
    return res.json({ success: true, status: 'paused' });
  } catch (error: any) {
    console.error('Error pausing campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/campaigns/:id/resume', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .update({ status: 'running' })
      .eq('id', id);
    
    if (error) throw error;
    try { await createZapEvent({ event_type: EVENT_TYPES.campaign_resumed, user_id: req.user!.id, entity: 'campaign', entity_id: id, payload: { status: 'running' } }); } catch {}
    return res.json({ success: true, status: 'running' });
  } catch (error: any) {
    console.error('Error resuming campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Relaunch campaign (set to draft so it can be scheduled again)
router.post('/campaigns/:id/relaunch', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .update({ status: 'draft' })
      .eq('id', id);
    if (error) throw error;
    try { await createZapEvent({ event_type: EVENT_TYPES.campaign_relaunched, user_id: req.user!.id, entity: 'campaign', entity_id: id, payload: { status: 'draft' } }); } catch {}
    return res.json({ success: true, status: 'draft' });
  } catch (error: any) {
    console.error('Error relaunching campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Delete campaign (cascade via FKs)
router.delete('/campaigns/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await scoped(req, 'sourcing_campaigns', 'created_by')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Removed duplicate - the search route at /campaigns/search handles both cases

export default router;
/**
 * REX Agent: Send tiered template to existing campaign leads
 */
router.post('/campaigns/:id/send-template', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({ selectedTemplateId: z.string(), userId: z.string() }).parse(req.body);
    const result = await sendTieredTemplateToCampaign({ campaignId: id, selectedTemplateId: body.selectedTemplateId, userId: body.userId });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Error sending tiered template:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * REX Agent: Generate & send new tiered sequence to existing campaign
 */
router.post('/campaigns/:id/generate-and-send', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({ userId: z.string(), jobTitle: z.string().optional(), tone: z.string().optional() }).parse(req.body);
    const result = await generateAndSendNewSequenceToCampaign({ campaignId: id, userId: body.userId, jobTitle: body.jobTitle, tone: body.tone });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Error generating/sending sequence:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * REX Agent: Send a one-off message or template to campaign
 */
router.post('/campaigns/:id/send-single', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = z.object({ userId: z.string(), subject: z.string().optional(), html: z.string().optional(), templateId: z.string().optional() }).parse(req.body);
    const result = await sendSingleMessageToCampaign({ campaignId: id, userId: body.userId, subject: body.subject, html: body.html, templateId: body.templateId });
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Error sending single message:', error);
    return res.status(400).json({ error: error.message });
  }
});

async function fetchAllSendgridVerifiedSenders(apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}` } as any;
  const limit = 500;
  let offset = 0;
  const out: any[] = [];

  // Safety cap to avoid infinite loops if SendGrid behavior changes
  for (let page = 0; page < 20; page++) {
    const resp = await axios.get('https://api.sendgrid.com/v3/verified_senders', {
      headers,
      params: { limit, offset },
      timeout: 15000,
    });
    const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
    out.push(...results);
    if (results.length < limit) break;
    offset += limit;
  }

  return out;
}

// Sync SendGrid senders for current user from SendGrid API
router.post('/senders/sync', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { data: keyRow } = await supabase
      .from('user_sendgrid_keys')
      .select('api_key')
      .eq('user_id', userId)
      .maybeSingle();
    if (!keyRow?.api_key) return res.status(400).json({ error: 'SendGrid not connected' });

    let rawVerified: any[] = [];
    try {
      rawVerified = await fetchAllSendgridVerifiedSenders(keyRow.api_key);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      console.error('[senders/sync] SendGrid verified_senders failed', { userId, status, data });
      return res.status(502).json({ error: 'Failed to fetch verified senders from SendGrid' });
    }

    const byEmail = new Map<string, { email: string; name?: string; verified: boolean }>();
    rawVerified.forEach((s: any) => {
      const emailRaw = String(s?.from_email || s?.email || '').trim();
      if (!emailRaw) return;
      const email = emailRaw.toLowerCase();
      const prev = byEmail.get(email);
      const name = String(s?.from_name || s?.nickname || s?.name || '').trim() || undefined;
      const verified = Boolean(s?.verified ?? true);
      byEmail.set(email, {
        email,
        name: name || prev?.name,
        verified: verified || prev?.verified || false,
      });
    });

    const upserts = Array.from(byEmail.values()).map(v => ({ user_id: userId, email: v.email, name: v.name || null, verified: v.verified }));
    if (!upserts.length) return res.status(400).json({ error: 'No verified senders found in SendGrid account' });

    // Replace rows so removed SendGrid senders disappear (keeps UI consistent with Settings list)
    const { error: delErr } = await supabase
      .from('user_sendgrid_senders')
      .delete()
      .eq('user_id', userId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase
      .from('user_sendgrid_senders')
      .insert(upserts);
    if (insErr) throw insErr;

    return res.json({ synced: upserts.length, replaced: true });
  } catch (error: any) {
    console.error('Error syncing senders:', error?.response?.data || error.message);
    return res.status(400).json({ error: error.message });
  }
});
