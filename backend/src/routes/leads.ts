console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { enrichWithApollo } from '../services/apollo/enrichLead';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import { requireAuth } from '../../middleware/authMiddleware';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { ApiRequest } from '../../types/api';
import { EmailEventService } from '../../services/emailEventService';
import axios from 'axios';

const router = express.Router();

// Debug logging for route registration
console.log('Registering leads routes...');

// GET /api/leads/candidates - fetch all candidates for the authenticated user
router.get('/candidates', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/leads - list leads for the authenticated user (mirrors candidate logic)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(leads || []);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST /api/leads/apollo/search
router.post('/apollo/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { jobTitle, keywords, location } = req.body;

    // 1. Check for active Apollo integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'apollo')
      .eq('status', 'connected')
      .single();

    // 2. If integration found, try to use OAuth token
    if (integration) {
      const { data: apolloTokens } = await supabase
        .from('apollo_accounts')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (apolloTokens?.access_token) {
        const apolloPayload = {
          q_organization_domains: [],
          title: jobTitle,
          keywords,
          location,
          page: 1,
          per_page: 10
        };

        const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apolloTokens.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(apolloPayload)
        });

        const data = await response.json() as { people?: any[]; contacts?: any[] };
        const leads = data.people || data.contacts || [];
        res.json({ leads });
        return; // CRITICAL: Early return to prevent double response
      }
    }

    // 3. Check if user has privileged role access to SUPER_ADMIN_APOLLO_API_KEY
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    // Check user metadata as fallback
    let authMetadata = null;
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      authMetadata = authUser?.user?.user_metadata;
    } catch (authError) {
      console.error('Error fetching auth metadata:', authError);
    }

    // Check if user is privileged (RecruitPro, TeamAdmin, admin, member)
    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const userRole = userRecord?.role || authMetadata?.role || authMetadata?.account_type;
    const isPrivileged = privilegedTypes.includes(userRole);

    console.log('[Apollo Search] Privilege check:', {
      userRole,
      isPrivileged,
      privilegedTypes
    });

    // If privileged user, use SUPER_ADMIN_APOLLO_API_KEY
    if (isPrivileged && process.env.SUPER_ADMIN_APOLLO_API_KEY) {
      console.log('[Apollo Search] Using SUPER_ADMIN_APOLLO_API_KEY for privileged user');
      
      // Use the CORRECT Apollo API format that actually works
      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');
      
      const searchParams = {
        api_key: process.env.SUPER_ADMIN_APOLLO_API_KEY,
        person_titles: jobTitle ? [jobTitle] : undefined,  // ✅ Correct parameter name
        q_keywords: keywords,                              // ✅ Keep keywords separate  
        person_locations: location ? [location] : undefined, // ✅ Correct parameter name
        page: 1,
        per_page: 100
      };

      console.log('[Apollo Search] PRIVILEGED USER - Using WORKING Apollo implementation:', {
        ...searchParams,
        api_key: '***'
      });

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 4. Fallback: Use API key from user_settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settings?.apollo_api_key) {
      console.log('[Apollo Search] Using user personal API key');
      
      // Use the CORRECT Apollo API format that actually works
      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');
      
      const searchParams = {
        api_key: settings.apollo_api_key,
        person_titles: jobTitle ? [jobTitle] : undefined,  // ✅ Correct parameter name
        q_keywords: keywords,                              // ✅ Keep keywords separate  
        person_locations: location ? [location] : undefined, // ✅ Correct parameter name
        page: 1,
        per_page: 100
      };

      console.log('[Apollo Search] USER API KEY - Using WORKING Apollo implementation:', {
        ...searchParams,
        api_key: '***'
      });

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 5. Final global fallback to SUPER_ADMIN_APOLLO_API_KEY (for non-privileged users)
    const superKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;

    if (superKey) {
      console.log('[Apollo Search] Using SUPER_ADMIN_APOLLO_API_KEY final fallback');
      
      // Use the CORRECT Apollo API format that actually works
      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');
      
      const searchParams = {
        api_key: superKey,
        person_titles: jobTitle ? [jobTitle] : undefined,  // ✅ Correct parameter name
        q_keywords: keywords,                              // ✅ Keep keywords separate  
        person_locations: location ? [location] : undefined, // ✅ Correct parameter name
        page: 1,
        per_page: 100
      };

      console.log('[Apollo Search] FINAL FALLBACK - Using WORKING Apollo implementation:', {
        ...searchParams,
        api_key: '***'
      });

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    res.status(400).json({ 
      error: 'No Apollo integration or API key found. Please connect your Apollo account or add an API key in the settings.' 
    });
  } catch (error) {
    console.error('Error searching Apollo:', error);
    res.status(500).json({ error: 'Failed to search Apollo' });
  }
});

// POST /api/leads/import
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { campaignId, leads, source, searchCriteria } = req.body;
    if (!campaignId || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing campaignId or leads' });
      return;
    }

    // Import the CreditService
    const { CreditService } = await import('../../services/creditService');

    // Check if user has enough credits
    const hasCredits = await CreditService.hasSufficientCredits(userId, leads.length);
    if (!hasCredits) {
      res.status(402).json({ 
        error: 'Insufficient credits', 
        required: leads.length,
        message: `You need ${leads.length} credits to import these leads.`
      });
      return;
    }

    const normalizedLeads = leads.map((lead: any) => {
      const first = lead.first_name || (lead.name ? lead.name.split(' ')[0] : '') || '';
      const last = lead.last_name || (lead.name ? lead.name.split(' ').slice(1).join(' ') : '') || '';
      const locationStr = lead.location || [lead.city, lead.state, lead.country].filter(Boolean).join(', ');

      return {
        user_id: userId,
        campaign_id: campaignId,
        first_name: first,
        last_name: last,
        name: lead.name || `${first} ${last}`.trim(),
        email: lead.email || '',
        title: lead.title || '',
        company: lead.company || '',
        linkedin_url: lead.linkedin_url || null,
        city: lead.city || null,
        state: lead.state || null,
        country: lead.country || null,
        location: locationStr || null,
        enrichment_data: lead.enrichment_data ? JSON.stringify(lead.enrichment_data) : null,
        enrichment_source: lead.enrichment_source || null,
        source_meta: lead.sourceMeta ? JSON.stringify(lead.sourceMeta) : null,
        source: source || null,
        status: 'New',
        created_at: new Date().toISOString(),
      };
    });

    // Insert leads into the database
    const { data, error } = await supabase
      .from('leads')
      .insert(normalizedLeads)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Deduct credits for the imported leads
    try {
      await CreditService.useCreditsEffective(userId, leads.length);
      
      // Log the specific usage for campaign lead import
      await CreditService.logCreditUsage(
        userId, 
        leads.length, 
        'api_usage', 
        `Campaign lead import: ${leads.length} leads added to campaign ${campaignId}`
      );
    } catch (creditError) {
      console.error('Error deducting credits:', creditError);
      // Note: leads were already inserted, so we log this but don't fail the request
    }

    // Update campaign totals
    console.log('📊 Updating campaign totals for campaign:', campaignId);
    try {
      // Get total and enriched lead counts for this campaign
      const { count: totalLeads, error: totalError } = await supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId);

      const { count: enrichedLeads, error: enrichedError } = await supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .not('email', 'is', null)
        .neq('email', '');

      console.log('📊 Campaign count results:', {
        totalLeads,
        enrichedLeads,
        totalError,
        enrichedError
      });

      if (totalError) {
        console.error('Error getting total leads count:', totalError);
      }

      if (enrichedError) {
        console.error('Error getting enriched leads count:', enrichedError);
      }

      // Update campaign with new counts and source
      const campaignUpdate: any = {
        total_leads: totalLeads || 0,
        enriched_leads: enrichedLeads || 0,
        updated_at: new Date().toISOString()
      };

      // Set campaign source if provided
      if (source) {
        campaignUpdate.source = source;
      }

      const { error: campaignError } = await supabase
        .from('campaigns')
        .update(campaignUpdate)
        .eq('id', campaignId);

      if (campaignError) {
        console.error('❌ Error updating campaign counts:', campaignError);
        // Don't fail the request but log it properly
      } else {
        console.log('✅ Campaign counts updated successfully:', {
          campaignId,
          totalLeads: totalLeads || 0,
          enrichedLeads: enrichedLeads || 0
        });
      }
    } catch (countError) {
      console.error('❌ Error updating campaign counts:', countError);
      // Don't fail the request for count update errors
    }

    // Send Apollo notifications if this is an Apollo campaign
    if (source === 'apollo' && data && data.length > 0) {
      try {
        const { sendApolloSearchNotifications } = await import('../../services/apolloNotificationService');
        
        console.log('[Leads Import] Sending Apollo notifications:', {
          userId,
          campaignId,
          source,
          searchCriteria,
          leadCount: data.length
        });
        
        // Send notifications asynchronously
        sendApolloSearchNotifications(userId, campaignId, searchCriteria || {}, data.length)
          .catch(error => {
            console.error('[Leads Import] Error sending Apollo notifications:', error);
          });
      } catch (importError) {
        console.error('[Leads Import] Error importing Apollo notification service:', importError);
      }
    }

    res.json({ 
      success: true, 
      data,
      imported: data?.length || 0,
      creditsUsed: leads.length
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// (Optional) POST /api/leads/csv/parse
router.post('/csv/parse', async (req: Request, res: Response) => {
  try {
    // TODO: Parse CSV file (stream or buffer) and return preview rows
    res.json({ preview: [] });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/leads/:id/enrich
router.post('/:id/enrich', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (leadError) {
      res.status(500).json({ error: leadError.message });
      return;
    }

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Enrich with Apollo
    const apolloData = await enrichWithApollo({
      leadId: lead.id,
      userId: lead.user_id,
      firstName: lead.first_name,
      lastName: lead.last_name,
      company: lead.company,
      linkedinUrl: lead.linkedin_url
    });

    // Analyze with GPT
    let gptAnalysis = null;
    try {
      if (lead.linkedin_url) {
        gptAnalysis = await analyzeProfile(lead.linkedin_url);
      }
    } catch (err) {
      console.error('GPT analysis failed:', err);
    }

    // Update lead with enriched data
    console.log('[enrich route] writing enrichment_data for', id);
    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({
        enrichment_data: {
          apollo: apolloData?.data || apolloData,
          gpt: gptAnalysis
        },
        enriched_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[enrich route] Supabase error', updateError);
    }

    res.json(updatedLead);
  } catch (error) {
    console.error('Error enriching lead:', error);
    res.status(500).json({ error: 'Failed to enrich lead' });
  }
});

// GET /api/leads/:id - fetch a single lead by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads/:id/convert - convert a lead to a candidate
router.post('/:id/convert', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id } = req.body;

  // --- PATCH: Strip 'Bearer ' prefix and verify JWT ---
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  let user, userError;
  try {
    const result = await supabase.auth.getUser(jwt);
    user = result.data.user;
    userError = result.error;
  } catch (err) {
    res.status(401).json({ error: 'JWT verification failed' });
    return;
  }
  // Decode JWT for iss/exp checks
  try {
    const { iss, exp } = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    if (!iss.startsWith(process.env.SUPABASE_URL)) {
      res.status(401).json({ error: 'token for wrong project' });
      return;
    }
    if (exp < Math.floor(Date.now()/1000)) {
      res.status(401).json({ error: 'token expired' });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: 'invalid JWT' });
    return;
  }
  if (!user) {
    res.status(401).json({ error: 'invalid or expired JWT' });
    return;
  }
  if (!user_id || user.id !== user_id) {
    res.status(401).json({ error: 'User ID mismatch or missing' });
    return;
  }
  // --- END PATCH ---

  try {
    // 1. Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.error('Lead fetch error:', leadError);
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // 2. Create candidate record
    let firstName = lead.first_name;
    let lastName = lead.last_name;
    if ((!firstName || !lastName) && lead.name) {
      const nameParts = lead.name.trim().split(' ');
      firstName = firstName || nameParts[0] || '';
      lastName = lastName || nameParts.slice(1).join(' ') || '';
    }
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        lead_id: lead.id,
        user_id: user.id,
        first_name: firstName || '',
        last_name: lastName || '',
        email: lead.email || null,
        phone: lead.phone || null,
        avatar_url: lead.avatar_url || null,
        status: 'sourced',
        enrichment_data: {
          ...(lead.enrichment_data || {}),
          current_title: lead.title || null
        },
        resume_url: null,
        notes: null,
        title: lead.title || null,
        linkedin_url: lead.linkedin_url || null
      })
      .select()
      .single();

    if (candidateError) {
      console.error('Candidate insert error:', candidateError);
      res.status(500).json({ error: 'db error', details: candidateError });
      return;
    }

    // 3. Record conversion event for analytics
    try {
      await EmailEventService.storeEvent({
        user_id: user.id,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        provider: 'system',
        message_id: `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'conversion',
        metadata: {
          candidate_id: candidate.id,
          lead_name: `${firstName} ${lastName}`.trim(),
          lead_email: lead.email,
          lead_title: lead.title,
          lead_company: lead.company,
          converted_at: new Date().toISOString()
        }
      });
      console.log('✅ Conversion event recorded for analytics');
    } catch (conversionError) {
      console.error('❌ Failed to record conversion event:', conversionError);
      // Don't fail the conversion for analytics errors
    }

    // 4. Delete the lead
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Lead delete error:', deleteError);
      res.status(500).json({ error: 'Failed to delete lead', details: deleteError });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Lead converted to candidate successfully',
      candidate
    });
  } catch (error) {
    console.error('Convert endpoint error:', error);
    res.status(500).json({ error: 'Failed to convert lead', details: error });
  }
});

// POST /api/leads/apollo/validate-key - simple key validation
router.post('/apollo/validate-key', requireAuth, async (req: Request, res: Response) => {
  const { api_key } = req.body;
  if (!api_key) {
    res.status(400).json({ error: 'Missing api_key' });
    return;
  }
  try {
    // minimal payload to check validity
    const resp = await axios.post('https://api.apollo.io/v1/mixed_people/search', {
      api_key,
      page: 1,
      per_page: 1
    });
    if (resp.status === 200) {
      res.status(200).json({ valid: true });
    } else {
      res.status(400).json({ error: 'invalid_key' });
    }
  } catch (e: any) {
    const msg = e.response?.data?.error || e.message || 'Validation failed';
    res.status(400).json({ error: msg });
  }
});

// POST /api/leads/apollo/save-key - persist API key in user_settings
router.post('/apollo/save-key', requireAuth, async (req: Request, res: Response) => {
  try {
    const { user_id, api_key } = req.body;
    if (!user_id || !api_key) {
      res.status(400).json({ error: 'Missing user_id or api_key' });
      return;
    }

    // Upsert into user_settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id, apollo_api_key: api_key }, { onConflict: 'user_id' });

    if (error) {
      console.error('Save key DB error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Ensure integrations table marks Apollo as connected
    await supabase.from('integrations').upsert({
      user_id,
      provider: 'apollo',
      status: 'connected',
      connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,provider' });

    res.json({ success: true });
  } catch (e: any) {
    console.error('Save key error:', e);
    res.status(500).json({ error: e.message || 'Failed to save key' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/leads - bulk delete (ids[] in body) for the authenticated user
// ---------------------------------------------------------------------------
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      res.status(400).json({ error: 'No ids provided' });
      return;
    }

    const { data: deletedRows, error } = await supabase
      .from('leads')
      .delete()
      .in('id', ids)
      .eq('user_id', userId)
      .select('id');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const deleted = (deletedRows || []).map((r: any) => r.id);
    const notFound = ids.filter(id => !deleted.includes(id));

    res.status(200).json({ deleted, notFound });
  } catch (error) {
    console.error('Error deleting leads:', error);
    res.status(500).json({ error: 'Failed to delete leads' });
  }
});

// Now, define any generic /:id routes below this line

console.log('Leads routes registered');

export const getLeads = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', req.user.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const createLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('leads')
      .insert([{ ...req.body, user_id: req.user.id }])
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
};

export const updateLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    
    // Get the original lead data for comparison
    const { data: originalLead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!originalLead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Update the lead
    const { data, error } = await supabase
      .from('leads')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Emit Zapier events
    try {
      await import('../../lib/zapEventEmitter').then(async ({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
        // Always emit lead updated event
        emitZapEvent({
          userId: req.user!.id,
          eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
          eventData: createLeadEventData(data, { 
            previous_status: originalLead.status,
            updated_fields: Object.keys(req.body)
          }),
          sourceTable: 'leads',
          sourceId: data.id
        });

        // If status changed, emit stage changed event
        if (req.body.status && req.body.status !== originalLead.status) {
          emitZapEvent({
            userId: req.user!.id,
            eventType: ZAP_EVENT_TYPES.LEAD_STAGE_CHANGED,
            eventData: createLeadEventData(data, {
              old_status: originalLead.status,
              new_status: req.body.status,
            }),
            sourceTable: 'leads',
            sourceId: data.id
          });
        }

        // If tags changed, we could add a specific event for that
        if (req.body.tags && JSON.stringify(req.body.tags) !== JSON.stringify(originalLead.tags)) {
          emitZapEvent({
            userId: req.user!.id,
            eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
            eventData: createLeadEventData(data, {
              previous_tags: originalLead.tags || [],
              new_tags: req.body.tags || [],
              action: 'tags_updated'
            }),
            sourceTable: 'leads',
            sourceId: data.id
          });
        }
      });
    } catch (zapierError) {
      console.error('Error emitting Zapier events:', zapierError);
      // Don't fail the request if Zapier events fail
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

export const deleteLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

export const getLeadById = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

// Add PATCH route for lead updates
router.patch('/:id', requireAuth, updateLead);

export default router; 