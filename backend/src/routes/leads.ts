console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { enrichWithApollo } from '../services/apollo/enrichLead';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import { enrichLead as enrichWithProxycurl } from '../../services/proxycurl/enrichLead';
import { requireAuth } from '../../middleware/authMiddleware';
import { searchAndEnrichPeople } from '../../utils/apolloApi';

const router = express.Router();

// Debug logging for route registration
console.log('Registering leads routes...');

// GET /api/leads/candidates - fetch all candidates for the authenticated user
router.get('/candidates', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { data: candidates, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
  res.json(candidates);
});

// POST /api/leads/apollo/search
router.post('/apollo/search', requireAuth, async (req: Request, res: Response) => {
  try {
    // Debug: log incoming headers and body
    console.log('[Apollo Search] Incoming headers:', req.headers);
    console.log('[Apollo Search] Incoming body:', req.body);
    const { jobTitle, keywords, location } = req.body;
    const userId = (req as any).auth?.user?.id;
    console.log('[Apollo Search] userId from req.auth:', userId);
    if (!userId) {
      console.error('[Apollo Search] Not authenticated: req.auth is', (req as any).auth);
      return res.status(401).json({ error: 'Not authenticated' });
    }

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
      // Try to get OAuth token
      const { data: apolloTokens } = await supabase
        .from('apollo_accounts')
        .select('access_token')
        .eq('user_id', userId)
        .single();
      if (apolloTokens?.access_token) {
        // Use OAuth token in Authorization header
        const apolloPayload = {
          q_organization_domains: [],
          title: jobTitle,
          keywords,
          location,
          page: 1,
          per_page: 10
        };
        const apolloHeaders = { Authorization: `Bearer ${apolloTokens.access_token}` };
        console.log('[Apollo API] Request payload:', apolloPayload);
        console.log('[Apollo API] Request headers:', apolloHeaders);
        try {
          const response = await axios.post('https://api.apollo.io/v1/mixed_people/search', apolloPayload, {
            headers: apolloHeaders
          });
          // Normalize response: always return { leads: [...] }
          const leads = response.data.people || response.data.contacts || [];
          return res.json({ leads });
        } catch (err: any) {
          console.error('[Apollo API] Error response:', err.response?.data);
          throw err;
        }
      }
    }

    // 3. Fallback: Use API key from user_settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();
    if (settingsError) throw settingsError;
    if (settings?.apollo_api_key) {
      // Build search params for Apollo
      const searchParams: any = {
        api_key: settings.apollo_api_key,
        page: 1,
        per_page: 100
      };
      if (jobTitle) searchParams.person_titles = [jobTitle];
      if (keywords) searchParams.q_keywords = keywords;
      if (location && location !== 'Any') searchParams.person_locations = [location];
      try {
        const { leads } = await searchAndEnrichPeople(searchParams);
        return res.json({ leads });
      } catch (err: any) {
        console.error('[Apollo API] Enrich error:', err.response?.data || err.message);
        throw err;
      }
    }

    // 4. If neither integration nor API key, return error
    return res.status(400).json({ error: 'No Apollo integration or API key found. Please connect your Apollo account or add an API key in the settings.' });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/leads/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { campaignId, leads } = req.body;
    if (!campaignId || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'Missing campaignId or leads' });
    }
    // Normalize leads to canonical schema
    const normalizedLeads = leads.map((lead: any) => {
      // Split name into first and last name
      let first_name = '';
      let last_name = '';
      if (lead.name) {
        const parts = lead.name.trim().split(' ');
        first_name = parts[0] || '';
        last_name = parts.slice(1).join(' ') || '';
      } else {
        first_name = lead.first_name || '';
        last_name = lead.last_name || '';
      }
      return {
        campaign_id: campaignId,
        first_name,
        last_name,
        title: lead.title || '',
        company: lead.company || '',
        email: lead.email || '',
        location: lead.location || '',
        source_meta: lead.sourceMeta ? JSON.stringify(lead.sourceMeta) : null,
        created_at: new Date().toISOString(),
      };
    });
    // Insert into campaign_leads
    const { data, error } = await supabase.from('campaign_leads').insert(normalizedLeads).select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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

// POST /api/leads/:id/enrich (child pattern, safest)
router.post('/:id/enrich', async (req: Request, res: Response) => {
  console.log('Enrich endpoint hit:', req.params.id);
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    // Sanity check: fail loudly if the table is missing
    const { error: existsError } = await supabase
      .from('leads')
      .select('id')
      .limit(1);
    if (existsError?.code === '42P01') {
      console.error('leads table missing! Run migrations.');
      return res.status(500).json({ error: 'DB schema missing: leads' });
    }

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.warn('Lead not found in DB', { id, leadError });
      if (!lead) return res.status(400).json({ error: 'Unknown lead id' });
      return res.status(404).json({ error: 'Lead not found' });
    }

    let enrichmentData = {};
    let apolloErrorMsg = null;
    let gptErrorMsg = null;

    // Log initial enrichmentData
    console.log('Initial enrichmentData:', enrichmentData);

    // If no email, try Apollo enrichment
    if (!lead.email && lead.linkedin_url) {
      try {
        const apolloResult = await enrichWithApollo({
          leadId: id,
          userId: user.id,
          firstName: lead.first_name,
          lastName: lead.last_name,
          company: lead.company,
          linkedinUrl: lead.linkedin_url
        });
        enrichmentData = { ...enrichmentData, ...apolloResult };
        console.log('After Apollo enrichmentData:', enrichmentData);
      } catch (apolloError: any) {
        apolloErrorMsg = apolloError?.message || 'Apollo enrichment failed';
        console.warn('Apollo enrichment failed:', apolloError);
      }
    }

    // If we have a LinkedIn URL, do GPT analysis
    if (lead.linkedin_url) {
      try {
        const { workHistory, gptNotes } = await analyzeProfile(lead.linkedin_url);
        enrichmentData = {
          ...enrichmentData,
          workHistory,
          gptNotes
        };
        console.log('After GPT enrichmentData:', enrichmentData);
      } catch (gptError: any) {
        gptErrorMsg = gptError?.message || 'GPT analysis failed';
        console.warn('GPT analysis failed:', gptError);
      }
    }

    // If we have a LinkedIn URL, do Proxycurl enrichment
    if (lead.linkedin_url) {
      try {
        console.log('[Leads] Starting Proxycurl enrichment for lead:', {
          id: lead.id,
          linkedin_url: lead.linkedin_url
        });
        
        const proxycurlResult = await enrichWithProxycurl({
          leadId: id,
          linkedinUrl: lead.linkedin_url
        });
        
        console.log('[Leads] Proxycurl result:', proxycurlResult);
        enrichmentData = { ...enrichmentData, proxycurl: proxycurlResult.data };
        console.log('[Leads] After Proxycurl enrichmentData:', enrichmentData);
      } catch (proxycurlError: any) {
        console.error('[Leads] Proxycurl enrichment failed:', proxycurlError);
        throw proxycurlError; // Re-throw to handle in the outer catch
      }
    }

    // Log final enrichmentData before saving
    console.log('Final enrichmentData to save:', enrichmentData);

    // Update the lead with all enrichment data
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({
        enrichment_data: {
          ...lead.enrichment_data,
          ...enrichmentData
        },
        enrichment_status: 'success',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      data: updated,
      apolloErrorMsg,
      gptErrorMsg
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Enrich error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
      return res.status(404).json({ error: 'Lead not found' });
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
    return res.status(401).json({ error: 'JWT verification failed' });
  }
  // Decode JWT for iss/exp checks
  try {
    const { iss, exp } = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    if (!iss.startsWith(process.env.SUPABASE_URL)) {
      return res.status(401).json({ error: 'token for wrong project' });
    }
    if (exp < Math.floor(Date.now()/1000)) {
      return res.status(401).json({ error: 'token expired' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'invalid JWT' });
  }
  if (!user) {
    return res.status(401).json({ error: 'invalid or expired JWT' });
  }
  if (!user_id || user.id !== user_id) {
    return res.status(401).json({ error: 'User ID mismatch or missing' });
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
      return res.status(404).json({ error: 'Lead not found' });
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
      return res.status(500).json({ error: 'db error', details: candidateError });
    }

    // 3. Delete the lead
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Lead delete error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete lead', details: deleteError });
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

// Now, define any generic /:id routes below this line

console.log('Leads routes registered');

export default router; 