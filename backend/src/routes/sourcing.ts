console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createCampaign, addLeads, generateSequenceForCampaign, scheduleCampaign } from '../services/sourcing';
import { getCampaignWithDetails, getLeadsForCampaign, searchCampaigns } from '../services/sourcingUtils';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../../middleware/authMiddleware';
import { ApiRequest } from '../../types/api';

const router = express.Router();

// Debug logging for route registration
console.log('Registering sourcing routes...');

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
    
    const campaign = await createCampaign(campaignData);
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
      })).min(1)
    }).parse(req.body);
    
    const result = await addLeads(id, body.leads);
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
    const campaign = await getCampaignWithDetails(id);
    return res.json(campaign);
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    return res.status(404).json({ error: 'Campaign not found' });
  }
});

// Get leads for campaign
router.get('/campaigns/:id/leads', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const leads = await getLeadsForCampaign(id, limit, offset);
    return res.json({ leads, limit, offset });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Search campaigns
router.get('/campaigns', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string,
      created_by: req.query.created_by as string || req.user?.id, // Default to user's campaigns
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };
    
    const campaigns = await searchCampaigns(filters);
    return res.json({ campaigns, ...filters });
  } catch (error: any) {
    console.error('Error searching campaigns:', error);
    return res.status(400).json({ error: error.message });
  }
});

// Get email senders
router.get('/senders', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { data: senders, error } = await supabase
      .from('email_senders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return res.json(senders);
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
    
    const { data: replies, error } = await supabase
      .from('sourcing_replies')
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
    const { error: replyError } = await supabase
      .from('sourcing_replies')
      .update({ 
        next_action: 'book',
        classified_as: 'positive' 
      })
      .eq('id', replyId);
    
    if (replyError) throw replyError;
    
    // Update lead status
    const { error: leadError } = await supabase
      .from('sourcing_leads')
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
    const { error: replyError } = await supabase
      .from('sourcing_replies')
      .update({ 
        next_action: 'disqualify',
        classified_as: 'negative' 
      })
      .eq('id', replyId);
    
    if (replyError) throw replyError;
    
    // Update lead status
    const { error: leadError } = await supabase
      .from('sourcing_leads')
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
    
    const { error } = await supabase
      .from('sourcing_campaigns')
      .update({ status: 'paused' })
      .eq('id', id);
    
    if (error) throw error;
    return res.json({ success: true, status: 'paused' });
  } catch (error: any) {
    console.error('Error pausing campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/campaigns/:id/resume', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('sourcing_campaigns')
      .update({ status: 'running' })
      .eq('id', id);
    
    if (error) throw error;
    return res.json({ success: true, status: 'running' });
  } catch (error: any) {
    console.error('Error resuming campaign:', error);
    return res.status(400).json({ error: error.message });
  }
});

export default router;
