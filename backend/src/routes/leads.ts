console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { enrichWithApollo } from '../services/apollo/enrichLead';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import { enrichLead as enrichWithProxycurl } from '../../services/proxycurl/enrichLead';
import { requireAuth } from '../../middleware/authMiddleware';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { ApiRequest } from '../../types/api';
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
      }
    }

    // 3. Fallback: Use API key from user_settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settings?.apollo_api_key) {
      const searchParams = {
        api_key: settings.apollo_api_key,
        page: 1,
        per_page: 100,
        ...(jobTitle && { person_titles: [jobTitle] }),
        ...(keywords && { q_keywords: keywords }),
        ...(location && location !== 'Any' && { person_locations: [location] })
      };

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
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

    const { campaignId, leads } = req.body;
    if (!campaignId || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing campaignId or leads' });
      return;
    }

    const normalizedLeads = leads.map((lead: any) => {
      const parts = (lead.name || '').trim().split(' ');
      return {
        campaign_id: campaignId,
        first_name: parts[0] || lead.first_name || '',
        last_name: parts.slice(1).join(' ') || lead.last_name || '',
        title: lead.title || '',
        company: lead.company || '',
        email: lead.email || '',
        location: lead.location || '',
        source_meta: lead.sourceMeta ? JSON.stringify(lead.sourceMeta) : null,
        created_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('campaign_leads')
      .insert(normalizedLeads)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, data });
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
    
    // Enrich with Proxycurl (non-fatal)
    let proxycurlData = null;
    try {
      if (lead.linkedin_url) {
        proxycurlData = await enrichWithProxycurl({ linkedinUrl: lead.linkedin_url });
      }
    } catch (err) {
      console.error('Proxycurl enrichment failed:', err);
    }

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
          proxycurl: proxycurlData?.data || proxycurlData,
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

    // 3. Delete the lead
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

// Now, define any generic /:id routes below this line

console.log('Leads routes registered');

export default router;

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