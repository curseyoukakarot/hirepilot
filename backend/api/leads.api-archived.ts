import { Router, Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { enrichLead as enrichWithApollo } from '../services/apollo/enrichLead';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import jwtDecode from 'jwt-decode';
import { sendApolloSearchNotifications } from '../services/apolloNotificationService';
// import sgMail from '@sendgrid/mail'; // Uncomment if you want email

const router = Router();
const slackWebhook = process.env.SLACK_WEBHOOK_URL!;
// sgMail.setApiKey(process.env.SENDGRID_API_KEY!); // Uncomment if using SendGrid

// ✅ IMPORT leads
router.post('/import', async (req: Request, res: Response) => {
  try {
    const leads = req.body.leads;

    if (!leads || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Invalid leads payload' });
      return;
    }

    const insertPromises = leads.map((lead: any) => {
      return supabase.from('leads').insert({
        name: lead.name || null,
        title: lead.title || null,
        company: lead.company || null,
        email: lead.email || null,
        linkedin_url: lead.linkedin_url || null,
        enrichment_data: lead.enrichment_data || {},
        status: 'completed',
        avatar: 'https://via.placeholder.com/40',
        tags: ['Tech'],
        campaign: 'Tech Campaign Q1',
        phone: '+1 (555) 000-0000',
      });
    });

    await Promise.all(insertPromises);

    await axios.post(slackWebhook, {
      text: `🚀 Imported ${leads.length} leads successfully!`,
    });

    // Send Apollo-specific notifications if source is Apollo
    const { campaignId, userId, source, searchCriteria } = req.body;
    if (source === 'apollo' && campaignId && userId && leads.length > 0) {
      sendApolloSearchNotifications(userId, campaignId, searchCriteria || {}, leads.length)
        .catch(error => {
          console.error('[Leads Import] Error sending Apollo notifications:', error);
        });
    }

    res.status(200).json({ success: true, message: `${leads.length} leads imported` });
  } catch (error) {
    console.error('❌ Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// ✅ LIST all leads
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('leads').select('*');
    if (error) {
      console.error('❌ Error fetching leads:', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Server error fetching leads:', error);
    res.status(500).json({ error: 'Server error fetching leads' });
  }
});

// ✅ ENRICH a single lead
router.post('/enrich', async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ error: 'Lead ID is required' });
    return;
  }

  try {
    // Simulate enrichment delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update enrichment_data in Supabase
    const { data, error } = await supabase
      .from('leads')
      .update({
        enrichment_data: { lastEnriched: new Date().toISOString() },
      })
      .eq('id', id);

    if (error) {
      console.error('❌ Supabase update error:', error);
      res.status(500).json({ error: 'Failed to enrich lead' });
      return;
    }

    res.status(200).json({ success: true, message: `Lead ${id} enriched`, data });
  } catch (error) {
    console.error('❌ Error enriching lead:', error);
    res.status(500).json({ error: 'Failed to enrich lead' });
  }
});

// Manual enrichment endpoint for a single lead
router.post('/:id/enrich', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // 1. Get the lead
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    let enrichmentData = {};
    let apolloErrorMsg = null;
    let gptErrorMsg = null;

    // 2. If no email, try Apollo enrichment
    if (!lead.email && lead.linkedin_url) {
      try {
        const apolloResult = await enrichWithApollo({
          leadId: id,
          userId: lead.user_id,
          firstName: lead.first_name,
          lastName: lead.last_name,
          company: lead.company,
          linkedinUrl: lead.linkedin_url
        });
        enrichmentData = { ...enrichmentData, ...apolloResult };
      } catch (apolloError: any) {
        apolloErrorMsg = apolloError?.message || 'Apollo enrichment failed';
        console.warn('Apollo enrichment failed:', apolloError);
      }
    }

    // 3. If we have a LinkedIn URL, do GPT analysis
    if (lead.linkedin_url) {
      try {
        const { workHistory, gptNotes } = await analyzeProfile(lead.linkedin_url);
        enrichmentData = {
          ...enrichmentData,
          workHistory,
          gptNotes
        };
      } catch (gptError: any) {
        gptErrorMsg = gptError?.message || 'GPT analysis failed';
        console.warn('GPT analysis failed:', gptError);
      }
    }

    // 4. Update the lead with all enrichment data
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

    if (updateError) throw updateError;

    res.json({ ...updated, apolloErrorMsg, gptErrorMsg });
  } catch (err: any) {
    console.error('Enrichment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ CONVERT lead to candidate
router.post('/:id/convert', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id } = req.body;

  // --- PATCH: Strip 'Bearer ' prefix and verify JWT ---
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  console.log('Raw JWT:', jwt.slice(0, 30));
  let user, userError;
  try {
    const result = await supabase.auth.getUser(jwt);
    user = result.data.user;
    userError = result.error;
    console.log('user?.id:', user?.id);
  } catch (err) {
    console.error('getUser threw:', err);
    res.status(401).json({ error: 'JWT verification failed' });
    return;
  }
  // Decode JWT for iss/exp checks
  try {
    const { iss, exp } = (jwtDecode as any)(jwt);
    console.log('JWT iss:', iss, 'exp:', exp, 'now:', Math.floor(Date.now()/1000));
    if (!iss.startsWith(process.env.SUPABASE_URL)) {
      res.status(401).json({ error: 'token for wrong project' });
      return;
    }
    if (exp < Math.floor(Date.now()/1000)) {
      res.status(401).json({ error: 'token expired' });
      return;
    }
  } catch (err) {
    console.error('JWT decode error:', err);
    res.status(401).json({ error: 'invalid JWT' });
    return;
  }
  if (!user) {
    console.error('Auth failed:', userError);
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
      console.error('❌ Error fetching lead:', leadError);
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
      console.error('❌ DB insert failed', candidateError);
      res.status(500).json({ error: 'db error' });
      return;
    }

    // Emit events for lead conversion and candidate creation
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData, createCandidateEventData }) => {
      // Emit lead converted event
      emitZapEvent({
        userId: user.id,
        eventType: ZAP_EVENT_TYPES.LEAD_CONVERTED,
        eventData: createLeadEventData(lead, { converted_to_candidate_id: candidate.id }),
        sourceTable: 'leads',
        sourceId: lead.id
      });

      // Emit candidate created event
      emitZapEvent({
        userId: user.id,
        eventType: ZAP_EVENT_TYPES.CANDIDATE_CREATED,
        eventData: createCandidateEventData(candidate, { converted_from_lead_id: lead.id }),
        sourceTable: 'candidates',
        sourceId: candidate.id
      });
    });

    // 3. Delete the lead
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting lead:', deleteError);
      res.status(500).json({ error: 'Failed to delete lead' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Lead converted to candidate successfully',
      candidate
    });
  } catch (error) {
    console.error('❌ Error converting lead:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

// Get all candidates
router.get('/candidates', async (req: Request, res: Response) => {
  try {
    // Get user from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Get candidates for this user
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select(`
        *,
        candidate_jobs (
          id,
          job_id,
          status,
          job_requisitions (
            id,
            title,
            department
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      res.status(500).json({ error: 'Failed to fetch candidates' });
      return;
    }

    res.status(200).json({ candidates: candidates || [] });
  } catch (error) {
    console.error('Server error fetching candidates:', error);
    res.status(500).json({ error: 'Server error fetching candidates' });
  }
});

export default router;
