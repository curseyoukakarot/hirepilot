console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { enrichWithApollo } from '../services/apollo/enrichLead';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import { requireAuth } from '../../middleware/authMiddleware';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { ApiRequest } from '../../types/api';
import { EmailEventService } from '../../services/emailEventService';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import { CreditService } from '../../services/creditService';
import { emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData } from '../../lib/zapEventEmitter';
import axios from 'axios';
import decodoRouter from './leads/decodo/salesNavigatorScraper';
import enrichmentRouter from './leads/decodo/enrichLeadProfile';
import { fetchHtml } from '../lib/decodoProxy';
import { notifySlack } from '../../lib/slack';

const router = express.Router();

// Debug logging for route registration
console.log('Registering leads routes...');

// Mount Decodo routes
router.use('/', decodoRouter);

// Add compatibility route for frontend that expects /api/leads/:id/enrich
router.post('/:id/enrich', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const leadId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: 'Lead ID is required'
      });
    }

    // Get lead details for the profile URL
    // Try to find a lead first; if not found, allow enrichment of a candidate by id (compat with candidate view)
    let entityType: 'lead' | 'candidate' = 'lead';
    let lead: any = null;
    // targetId is the primary key we will use for subsequent updates (may differ from the incoming id if we matched candidate by lead_id)
    let targetId: string = leadId;
    {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)  // Security: ensure user owns this lead
        .maybeSingle();
      lead = data;
      if (error) {
        // proceed to candidate lookup
      }
    }
    if (!lead) {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      if (candidate) {
        entityType = 'candidate';
        // Normalize to lead-like shape expected by enrichment pipeline
        lead = {
          id: candidate.id,
          user_id: candidate.user_id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
          email: candidate.email || null,
          phone: candidate.phone || null,
          title: candidate.title || null,
          company: candidate.company || null,
          linkedin_url: candidate.linkedin_url || null,
          enrichment_data: candidate.enrichment_data || {},
        };
        targetId = candidate.id;
      } else {
        // Final attempt: sometimes frontend passes lead_id for candidates; look up candidate by lead_id
        const { data: candidateByLead } = await supabase
          .from('candidates')
          .select('*')
          .eq('lead_id', leadId)
          .maybeSingle();
        if (candidateByLead) {
          entityType = 'candidate';
          lead = {
            id: candidateByLead.id,
            user_id: candidateByLead.user_id,
            first_name: candidateByLead.first_name,
            last_name: candidateByLead.last_name,
            name: `${candidateByLead.first_name || ''} ${candidateByLead.last_name || ''}`.trim(),
            email: candidateByLead.email || null,
            phone: candidateByLead.phone || null,
            title: candidateByLead.title || null,
            company: candidateByLead.company || null,
            linkedin_url: candidateByLead.linkedin_url || null,
            enrichment_data: candidateByLead.enrichment_data || {},
          };
          targetId = candidateByLead.id;
        } else {
          // One last permissive check: try resolving by id without user constraint and allow if same team
          // Try lead first
          const { data: leadAny } = await supabase
            .from('leads')
            .select('*, user_id')
            .eq('id', leadId)
            .maybeSingle();
          if (leadAny) {
            // Check team membership
            const { data: me } = await supabase.from('users').select('id, team_id, role').eq('id', userId).maybeSingle();
            const { data: owner } = await supabase.from('users').select('id, team_id').eq('id', leadAny.user_id).maybeSingle();
            const sameTeam = (me as any)?.team_id && owner?.team_id && (me as any).team_id === owner.team_id;
            const privileged = ['team_admin','super_admin','SuperAdmin'].includes(((me as any)?.role)||'');
            if (sameTeam || privileged) {
              entityType = 'lead';
              lead = leadAny;
              targetId = leadAny.id;
            }
          }
          // If still not resolved, try candidate without user filter
          if (!lead) {
            const { data: candAny } = await supabase
              .from('candidates')
              .select('*')
              .or(`id.eq.${leadId},lead_id.eq.${leadId}`)
              .maybeSingle();
            if (candAny) {
              const { data: me } = await supabase.from('users').select('id, team_id, role').eq('id', userId).maybeSingle();
              const { data: owner } = await supabase.from('users').select('id, team_id').eq('id', candAny.user_id).maybeSingle();
              const sameTeam = (me as any)?.team_id && owner?.team_id && (me as any).team_id === owner.team_id;
              const privileged = ['team_admin','super_admin','SuperAdmin'].includes(((me as any)?.role)||'');
              if (sameTeam || privileged || candAny.user_id === userId) {
                entityType = 'candidate';
                lead = {
                  id: candAny.id,
                  user_id: candAny.user_id,
                  first_name: candAny.first_name,
                  last_name: candAny.last_name,
                  name: `${candAny.first_name || ''} ${candAny.last_name || ''}`.trim(),
                  email: candAny.email || null,
                  phone: candAny.phone || null,
                  title: candAny.title || null,
                  company: candAny.company || null,
                  linkedin_url: candAny.linkedin_url || null,
                  enrichment_data: candAny.enrichment_data || {},
                };
                targetId = candAny.id;
              }
            }
          }
          if (!lead) {
            return res.status(404).json({
              success: false,
              message: 'Lead not found or access denied'
            });
          }
        }
      }
    }

    console.log(`[LeadEnrich] Starting enrichment for lead: ${lead.first_name} ${lead.last_name}`);

    // Require user to have at least 1 credit before running enrichment providers
    try {
      const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
      if (!hasCredits) {
        return res.status(402).json({ success: false, message: 'Insufficient credits for enrichment', required: 1 });
      }
    } catch (e) {
      // Non-fatal: if credit service is unavailable, allow attempt but still try to deduct on success
      console.warn('[LeadEnrich] Credit pre-check failed (continuing):', (e as any)?.message || e);
    }

    let enrichmentData: any = {};
    let enrichmentSource = 'none';
    let errorMessages: string[] = [];

    // STEP 1: Try Decodo first (with LinkedIn authentication)
    if (lead.linkedin_url) {
      try {
        console.log('[LeadEnrich] Step 1: Attempting Decodo enrichment...');
        
        // Import the enrichWithDecodo function from the enrichLeadProfile module
        const enrichLeadProfileModule = await import('./leads/decodo/enrichLeadProfile');
        
        // The function is not exported, so we'll call the Decodo logic directly
        const { decryptCookie } = await import('../utils/encryption');
        
        // Get LinkedIn cookie for authenticated scraping
        const { data: cookieData } = await supabase
          .from('linkedin_cookies')
          .select('encrypted_cookie, valid, updated_at')
          .eq('user_id', userId)
          .single();

        // Enforce freshness (24h) and validity
        const cookieFresh = cookieData && cookieData.updated_at && new Date(cookieData.updated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (!cookieData || !cookieData.valid || !cookieFresh) {
          const { ErrorWithCode } = await import('../utils/errors');
          throw new ErrorWithCode('Missing or stale LinkedIn cookie', 402);
        }

        let linkedinCookie = null;
        if (cookieData?.encrypted_cookie) {
          try {
            linkedinCookie = decryptCookie(cookieData.encrypted_cookie);
            await supabase
              .from('linkedin_cookies')
              .update({ last_used_at: new Date().toISOString() })
              .eq('user_id', userId);
          } catch (error) {
            console.warn('[LeadEnrich] Failed to decrypt LinkedIn cookie:', error);
          }
        }

        const { html, size } = await fetchHtml(lead.linkedin_url, linkedinCookie ? `li_at=${linkedinCookie}` : '');

        // Log bandwidth usage for auditing
        await supabase
          .from('decodo_bandwidth_log')
          .insert({ user_id: userId, type: 'profile', bytes: size, created_at: new Date().toISOString() });

        if (html && !html.includes('Sign in to LinkedIn')) {
          // Parse the LinkedIn profile data using Cheerio
          const { parseLinkedInProfile } = await import('../utils/cheerio/salesNavParser');
          const profileData = parseLinkedInProfile(html);

          if (profileData.headline || profileData.summary || profileData.experience?.length || profileData.email) {
            enrichmentData.decodo = {
              ...profileData,
              enriched_at: new Date().toISOString()
            };
            enrichmentSource = 'decodo';
            console.log('[LeadEnrich] ✅ Decodo enrichment successful');
          }
        } else {
          console.log('[LeadEnrich] ❌ Decodo failed: LinkedIn authentication required');
          errorMessages.push('Decodo: LinkedIn authentication required');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Decodo enrichment failed:', error.message);
        errorMessages.push(`Decodo: ${error.message}`);
      }
    }

    // STEP 2: If Decodo didn't find email, try Hunter.io
    if (!enrichmentData.decodo?.email) {
      try {
        console.log('[LeadEnrich] Step 2: Trying Hunter.io email enrichment...');
        const { enrichWithHunter } = await import('../../services/hunter/enrichLead');
        
        const fullName = `${lead.first_name} ${lead.last_name}`.trim();
        const domain = lead.company ? lead.company.toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
        
        const hunterResult = await enrichWithHunter(process.env.HUNTER_API_KEY || '', fullName, domain);
        
        if (hunterResult) {
          enrichmentData.hunter = {
            email: hunterResult,
            enriched_at: new Date().toISOString()
          };
          if (enrichmentSource === 'none') enrichmentSource = 'hunter';
          console.log('[LeadEnrich] ✅ Hunter.io enrichment successful');
        } else {
          console.log('[LeadEnrich] ❌ Hunter.io: No email found');
          errorMessages.push('Hunter: No email found');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Hunter enrichment failed:', error.message);
        errorMessages.push(`Hunter: ${error.message}`);
      }
    }

    // STEP 3: If still no email, try Skrapp.io
    if (!enrichmentData.decodo?.email && !enrichmentData.hunter?.email) {
      try {
        console.log('[LeadEnrich] Step 3: Trying Skrapp.io email enrichment...');
        const { enrichWithSkrapp, enrichCompanyWithSkrapp } = await import('../../services/skrapp/enrichLead');
        
        const fullName = `${lead.first_name} ${lead.last_name}`.trim();
        const domain = lead.company ? lead.company.toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
        
        const skrappKey = process.env.SKRAPP_API_KEY || '';
        const skrappResult = await enrichWithSkrapp(skrappKey, fullName, domain, lead.company);
        const skrappCompany = domain && skrappKey ? await enrichCompanyWithSkrapp(skrappKey, domain).catch(()=>null) : null;
        
        if (skrappResult) {
          enrichmentData.skrapp = {
            email: skrappResult,
            enriched_at: new Date().toISOString(),
            company: skrappCompany || undefined
          };
          if (enrichmentSource === 'none') enrichmentSource = 'skrapp';
          console.log('[LeadEnrich] ✅ Skrapp.io enrichment successful');
        } else {
          console.log('[LeadEnrich] ❌ Skrapp.io: No email found');
          errorMessages.push('Skrapp: No email found');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Skrapp enrichment failed:', error.message);
        errorMessages.push(`Skrapp: ${error.message}`);
      }
    }

    // STEP 4: Apollo enrichment - run if no email found OR if Apollo data is incomplete
    const hasCompleteApolloData = lead.enrichment_data?.apollo?.employment_history || 
                                  lead.enrichment_data?.apollo?.functions || 
                                  lead.enrichment_data?.apollo?.departments;
    
    if (!enrichmentData.decodo?.email && !enrichmentData.hunter?.email && !enrichmentData.skrapp?.email || 
        !hasCompleteApolloData) {
      try {
        console.log(!hasCompleteApolloData ? 
          '[LeadEnrich] Step 4: Running Apollo enrichment for complete profile data...' : 
          '[LeadEnrich] Step 4: Using Apollo as final fallback...');
        const apolloResult = await enrichWithApollo({
          leadId: leadId,
          userId: userId,
          firstName: lead.first_name,
          lastName: lead.last_name,
          company: lead.company,
          linkedinUrl: lead.linkedin_url
        });

        if (apolloResult && apolloResult.success && apolloResult.data) {
          enrichmentData.apollo = {
            ...apolloResult.data,
            used_as_fallback: true,
            enriched_at: new Date().toISOString()
          };
          if (enrichmentSource === 'none') enrichmentSource = 'apollo';
          console.log('[LeadEnrich] ✅ Apollo enrichment successful (fallback)');
        } else {
          console.log('[LeadEnrich] ❌ Apollo: No data found');
          errorMessages.push('Apollo: No data found');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Apollo enrichment failed:', error.message);
        errorMessages.push(`Apollo: ${error.message}`);
      }
    }

    // Update lead with enrichment data
    const updateData: any = {
      enrichment_data: {
        ...(lead.enrichment_data || {}),
        ...enrichmentData,
        last_enrichment_attempt: {
          attempted_at: new Date().toISOString(),
          source: enrichmentSource,
          errors: errorMessages
        }
      },
      updated_at: new Date().toISOString()
    };

    // Extract primary email to lead.email field (priority: Decodo > Hunter > Skrapp > Apollo)
    const primaryEmail = enrichmentData.decodo?.email || 
                        enrichmentData.hunter?.email || 
                        enrichmentData.skrapp?.email || 
                        enrichmentData.apollo?.email;
    
    if (primaryEmail && !primaryEmail.includes('email_not_unlocked')) {
      updateData.email = primaryEmail;
    }

    // Extract primary phone if available
    const primaryPhone = enrichmentData.apollo?.phone || enrichmentData.decodo?.phone;
    if (primaryPhone) {
      updateData.phone = primaryPhone;
    }

    // Extract title/headline if available  
    const headline = enrichmentData.decodo?.headline || 
                    enrichmentData.apollo?.title || 
                    enrichmentData.apollo?.headline;
    if (headline) {
      updateData.title = headline;
    }

    let updatedLead: any = null;
    if (entityType === 'lead') {
      const { data, error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', targetId)
        .select()
        .maybeSingle();
      if (updateError) {
        console.error('[LeadEnrich] Failed to update lead:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save enrichment data'
        });
      }
      updatedLead = data;
    } else {
      // Update candidate record when enrichment performed from candidate view
      const candidateUpdate: any = {
        enrichment_data: updateData.enrichment_data,
        updated_at: new Date().toISOString()
      };
      if (updateData.email !== undefined) candidateUpdate.email = updateData.email;
      if (updateData.phone !== undefined) candidateUpdate.phone = updateData.phone;
      if (updateData.title !== undefined) candidateUpdate.title = updateData.title;

      const { data, error: updateError } = await supabase
        .from('candidates')
        .update(candidateUpdate)
        .eq('id', targetId)
        .select('*')
        .maybeSingle();
      if (updateError) {
        console.error('[LeadEnrich] Failed to update candidate:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save enrichment data'
        });
      }
      updatedLead = data;
    }

    console.log(`[LeadEnrich] Enrichment completed. Source: ${enrichmentSource}`);

    // Deduct 1 credit only if we obtained any enrichment (source != none)
    if (enrichmentSource !== 'none') {
      try {
        await CreditService.deductCredits(
          userId as string,
          1,
          'api_usage',
          `Profile enrichment: ${lead.first_name || ''} ${lead.last_name || ''}`.trim()
        );
      } catch (creditErr) {
        console.error('[LeadEnrich] Credit deduction failed (non-fatal):', creditErr);
      }
    }

    // Emit automation event: lead_enrich_requested
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.lead_enrich_requested,
        user_id: userId!,
        entity: 'lead',
        entity_id: targetId,
        payload: { source: enrichmentSource, errors: errorMessages }
      });
    } catch {}

    // Return updated lead with enrichment status
    return res.status(200).json({
      ...updatedLead,
      enrichment_status: {
        source: enrichmentSource,
        success: enrichmentSource !== 'none',
        errors: errorMessages
      }
    });

  } catch (error: any) {
    console.error('[LeadEnrich] Error in compatibility endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during enrichment',
      error: error.message
    });
  }
});

// POST /api/leads/:id/unlock-enhanced - Deduct 1 credit and unlock enhanced enrichment for this lead
router.post('/:id/unlock-enhanced', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const leadId = req.params.id;
    const userId = (req as any).user?.id as string;

    if (!leadId || !userId) {
      res.status(400).json({ error: 'Missing leadId or userId' });
      return;
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // If already unlocked, return early
    if ((lead as any).has_enhanced_enrichment === true) {
      res.json({ lead });
      return;
    }

    // Check credits (1 credit for enhanced enrichment toggle)
    const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
    if (!hasCredits) {
      res.status(402).json({ error: 'Insufficient credits', requiredCredits: 1 });
      return;
    }

    // Deduct 1 credit (logs usage appropriately)
    await CreditService.deductCredits(userId, 1, 'api_usage', 'Enhanced enrichment toggle');

    // Update lead flag
    const { data: updatedLead, error: updErr } = await supabase
      .from('leads')
      .update({ has_enhanced_enrichment: true, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select('*')
      .maybeSingle();

    if (updErr || !updatedLead) {
      res.status(500).json({ error: 'Failed to update lead flag' });
      return;
    }

    // Emit event for analytics/automation
    try {
      await emitZapEvent({
        userId,
        eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
        eventData: createLeadEventData(updatedLead, {
          event_type: 'enhanced_enrichment_unlocked',
          metadata: { leadId, orgId: updatedLead.enrichment_data?.apollo?.organization?.id || null, userId }
        }),
        sourceTable: 'leads',
        sourceId: leadId
      });
    } catch {}

    res.json({ lead: updatedLead });
  } catch (error: any) {
    console.error('[unlock-enhanced] error', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// POST /api/leads/candidates/bulk-status - update multiple candidates' status (owner only)
router.post('/candidates/bulk-status', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids, status } = req.body || {};
    console.log('[POST /api/leads/candidates/bulk-status]', { idsCount: Array.isArray(ids) ? ids.length : 0, status });
    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'Missing ids' }); return; }
    if (!ALLOWED_STATUS.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

    const { error } = await supabase
      .from('candidates')
      .update({ status })
      .in('id', ids)
      .eq('user_id', userId);
    if (error) { res.status(500).json({ error: 'Failed to update status' }); return; }
    res.json({ success: true });
  } catch (e) {
    console.error('Bulk status (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/leads/candidates/bulk-delete - delete multiple candidates (owner only)
router.post('/candidates/bulk-delete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids } = req.body || {};
    console.log('[POST /api/leads/candidates/bulk-delete]', { idsCount: Array.isArray(ids) ? ids.length : 0 });
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'Missing ids' }); return; }

    // Determine caller capabilities
    const { data: me } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .maybeSingle();
    const myTeamId = (me as any)?.team_id || null;
    const myRole = ((me as any)?.role || '').toLowerCase();
    const isSuperAdmin = myRole === 'super_admin' || myRole === 'superadmin';
    const isTeamAdmin = myRole === 'team_admin';

    let allowedIds: string[] = [];
    if (isSuperAdmin) {
      // Super admins can delete any provided ids
      allowedIds = ids as string[];
    } else if (isTeamAdmin && myTeamId) {
      // Team admins can delete their own + team-owned candidates
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', myTeamId);
      const teamUserIds = (teamUsers || []).map((u: any) => u.id);
      const { data: teamOwned } = await supabase
        .from('candidates')
        .select('id')
        .in('id', ids)
        .in('user_id', [...teamUserIds, userId]);
      allowedIds = (teamOwned || []).map((r: any) => r.id);
    } else {
      // Regular members can delete only their own candidates
      const { data: owned } = await supabase
        .from('candidates')
        .select('id')
        .in('id', ids)
        .eq('user_id', userId);
      allowedIds = (owned || []).map((r: any) => r.id);
    }

    if (allowedIds.length === 0) { res.json({ success: true, deleted: 0, notDeleted: ids }); return; }

    // Chunk deletions to avoid PostgREST URL length limits
    const chunkSize = 100;
    let deleted: string[] = [];
    const idSet = new Set<string>(allowedIds);

    // 1) Delete candidate_jobs in chunks
    for (let i = 0; i < allowedIds.length; i += chunkSize) {
      const chunk = allowedIds.slice(i, i + chunkSize);
      const { error: cjErr } = await supabase
        .from('candidate_jobs')
        .delete()
        .in('candidate_id', chunk);
      if (cjErr) {
        console.error('[bulk-delete] candidate_jobs delete error for chunk', cjErr);
        // continue; safe to attempt candidate delete anyway
      }
    }

    // 2) Delete candidates in chunks, collect deleted ids
    for (let i = 0; i < allowedIds.length; i += chunkSize) {
      const chunk = allowedIds.slice(i, i + chunkSize);
      const { data: delRows, error: delErr } = await supabase
        .from('candidates')
        .delete()
        .in('id', chunk)
        .select('id');
      if (delErr) {
        console.error('[bulk-delete] candidates delete error for chunk', delErr);
        // skip this chunk
        continue;
      }
      if (delRows && delRows.length) {
        deleted.push(...delRows.map((r: any) => r.id));
      }
    }

    const notDeleted = (ids as string[]).filter((id) => !deleted.includes(id) && idSet.has(id));
    res.json({ success: true, deleted: deleted.length, notDeleted });
  } catch (e) {
    console.error('Bulk delete (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount the Decodo enrichment router under a scoped path to avoid route conflicts
router.use('/decodo', enrichmentRouter);

// GET /api/leads/candidates - fetch all candidates for the authenticated user
router.get('/candidates', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('GET /api/leads/candidates');
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's team_id and role for team sharing
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user team:', userError);
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    // Build query based on user role
    let query = supabase
      .from('candidates')
      .select('*');

    const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
    
    if (isAdmin && userData.team_id) {
      // Admins see their own candidates and all candidates in their team (shared or not)
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', userData.team_id);
      const teamUserIds = (teamUsers || []).map((u: any) => u.id).filter(Boolean);
      if (teamUserIds.length > 0) {
        // Fetch by explicit IN list rather than raw SQL subselects
        query = query.or(`user_id.eq.${userId},user_id.in.(${teamUserIds.join(',')})`);
      } else {
        query = query.eq('user_id', userId);
      }
    } else if (userData.team_id) {
      // Members see their own candidates + shared candidates from team
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', userData.team_id);
      const teamUserIds = (teamUsers || []).map((u: any) => u.id).filter(Boolean);
      if (teamUserIds.length > 0) {
        query = query.or(`user_id.eq.${userId},and(user_id.in.(${teamUserIds.join(',')}),shared.eq.true)`);
      } else {
        query = query.eq('user_id', userId);
      }
    } else {
      // No team - only see own candidates
      query = query.eq('user_id', userId);
    }

    const { data: candidates, error } = await query.order('created_at', { ascending: false });

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

// POST /api/leads/candidates - create a new candidate for the authenticated user
router.post('/candidates', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      title,
      linkedin_url,
      status
    } = req.body || {};

    // If no email is provided, generate a unique placeholder to satisfy NOT NULL + UNIQUE(email)
    // Format: unknown+<userprefix>+<timestamp>@noemail.hirepilot
    const providedEmail: string | undefined = typeof email === 'string' ? email.trim() : undefined;
    const safeEmail = providedEmail && providedEmail.length > 0
      ? providedEmail
      : `unknown+${(userId || '').slice(0,8)}+${Date.now()}@noemail.hirepilot`;

    // If a real email is provided, proactively check for duplicates to return a clear message
    if (providedEmail) {
      const { data: existingAny } = await supabase
        .from('candidates')
        .select('id,user_id')
        .eq('email', providedEmail)
        .maybeSingle();
      if (existingAny) {
        res.status(409).json({ error: 'candidate_email_exists', message: 'A candidate with this email already exists.' });
        return;
      }
    }

    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    const candidateStatus = ALLOWED_STATUS.includes(status) ? status : 'sourced';

    const insertRow: any = {
      user_id: userId,
      first_name: first_name || '',
      last_name: last_name || '',
      email: safeEmail,
      phone: phone || null,
      title: title || null,
      linkedin_url: linkedin_url || null,
      status: candidateStatus,
      enrichment_data: {},
      notes: null
    };

    const { data, error } = await supabase
      .from('candidates')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // Handle duplicate key conflicts clearly
      if ((error as any)?.code === '23505') {
        res.status(409).json({ error: 'candidate_email_exists', message: 'A candidate with this email already exists.' });
        return;
      }
      res.status(500).json({ error: 'Failed to create candidate', details: (error as any)?.message || String(error) });
      return;
    }

    try {
      const { createZapEvent, EVENT_TYPES } = await import('../lib/events');
      const src = (req.body?.source || req.body?.enrichment_source || '').toString().toLowerCase();
      const allowed = new Set(['apollo','skrapp','hunter','linkedin','sourcing_campaign','sales_nav','chrome_extension']);
      const normalized = src === 'chrome extension' ? 'chrome_extension' : src;
      if (allowed.has(normalized)) {
        await createZapEvent({
          event_type: EVENT_TYPES.lead_source_added as any,
          user_id: req.user.id,
          entity: 'leads',
          entity_id: (data as any)?.id,
          payload: { source: normalized }
        });
      }
    } catch {}
    res.status(201).json(data);
  } catch (e) {
    console.error('Create candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/leads/candidates/:id/resume - upload resume file and set resume_url
router.post('/candidates/:id/resume', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string | undefined;
    const candidateId = req.params.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!candidateId) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    // Verify ownership
    const { data: existing, error: ownErr } = await supabase
      .from('candidates')
      .select('id, user_id')
      .eq('id', candidateId)
      .maybeSingle();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    const file = (req.body as any)?.file || {};
    const fileData: string = typeof file.data === 'string' ? file.data : '';
    const fileName: string = typeof file.name === 'string' ? file.name : 'resume.pdf';
    if (!fileData) { res.status(400).json({ error: 'Missing file data' }); return; }

    // Upload to storage using service role
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) { res.status(500).json({ error: 'Storage not configured' }); return; }
    const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    try {
      // Ensure storage bucket exists (idempotent)
      try {
        const { data: bucket, error: bucketErr } = await admin.storage.getBucket('uploads');
        if (bucketErr || !bucket) {
          await admin.storage.createBucket('uploads', { public: true, fileSizeLimit: '20MB' }).catch(() => {});
        }
      } catch {}

      const base64 = String(fileData).split(',').pop() || '';
      const bytes = Buffer.from(base64, 'base64');
      const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const path = `resumes/${userId}/${Date.now()}_${safeName}`;
      // Detect content type from extension
      const ext = (safeName.split('.').pop() || '').toLowerCase();
      const type = ext === 'pdf' ? 'application/pdf' : (ext === 'doc' ? 'application/msword' : (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'));
      const { error: upErr } = await admin.storage.from('uploads').upload(path, bytes, { upsert: false, contentType: type });
      if (upErr) { res.status(500).json({ error: upErr.message || 'Upload failed' }); return; }
      const { data: pub } = admin.storage.from('uploads').getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      if (!publicUrl) { res.status(500).json({ error: 'Failed to get public URL' }); return; }

      const { data: updated, error: updErr } = await supabase
        .from('candidates')
        .update({ resume_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', candidateId)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updErr || !updated) { res.status(500).json({ error: 'Failed to save resume URL' }); return; }

      res.json({ success: true, candidate: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/leads/candidates/:id - update candidate via leads router (for compatibility)
router.put('/candidates/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[PUT /api/leads/candidates/:id] body=', req.body);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!id) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    const { data: existing, error: ownErr } = await supabase
      .from('candidates')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    const ALLOWED_STATUS = ['sourced','contacted','interviewed','offered','hired','rejected'];
    const { status, first_name, last_name, email, phone, notes } = req.body || {};
    const update: any = {};
    if (status) {
      if (!ALLOWED_STATUS.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
      update.status = status;
    }
    if (first_name !== undefined) update.first_name = first_name;
    if (last_name !== undefined) update.last_name = last_name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await supabase
      .from('candidates')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: 'Failed to update candidate' }); return; }
    res.json(data);
  } catch (e) {
    console.error('Update candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/leads/candidates/:id - delete candidate via leads router (for compatibility)
router.delete('/candidates/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[DELETE /api/leads/candidates/:id] id=', req.params.id);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!id) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    const { data: existing, error: ownErr } = await supabase
      .from('candidates')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    // Remove job links first to avoid FK violations
    await supabase
      .from('candidate_jobs')
      .delete()
      .eq('candidate_id', id);

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) { res.status(500).json({ error: 'Failed to delete candidate' }); return; }
    res.json({ success: true });
  } catch (e) {
    console.error('Delete candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
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

    // Get campaign filter from query params
    const campaignId = req.query.campaignId as string;

    // Get user's team_id and role for team sharing
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user team:', userError);
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    // Build query based on user role
    let query = supabase
      .from('leads')
      .select('*');

    const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
    
    if (isAdmin && userData.team_id) {
      // Admins see all leads in their team (shared or not)
      query = query.or(`user_id.eq.${userId},and(team_id.eq.${userData.team_id})`);
    } else if (userData.team_id) {
      // Members see their own leads + shared leads from team
      query = query.or(`user_id.eq.${userId},and(team_id.eq.${userData.team_id},shared.eq.true)`);
    } else {
      // No team - only see own leads
      query = query.eq('user_id', userId);
    }
    
    // Add campaign filter if provided
    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: leads, error } = await query.order('created_at', { ascending: false });

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

    const { jobTitle, keywords, location, booleanSearch } = req.body;

    console.log('[Apollo Search] Request parameters:', {
      jobTitle,
      keywords,
      location,
      booleanSearch
    });

    // 1) Prefer the shared SUPER_ADMIN_APOLLO_API_KEY for ALL users (centralized credits)
    if (process.env.SUPER_ADMIN_APOLLO_API_KEY) {
      console.log('[Apollo Search] Using SUPER_ADMIN_APOLLO_API_KEY (global first)');

      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');

      const searchParams: any = {
        api_key: process.env.SUPER_ADMIN_APOLLO_API_KEY,
        person_locations: location ? [location] : undefined,
        page: 1,
        per_page: 100,
      };

      if (booleanSearch && keywords) {
        searchParams.person_titles = [keywords.trim()];
      } else {
        if (jobTitle) searchParams.person_titles = [jobTitle];
        if (keywords) searchParams.q_keywords = keywords;
      }

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 2) Next, try OAuth integration token if connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'apollo')
      .eq('status', 'connected')
      .single();

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
          per_page: 10,
        };

        const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apolloTokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apolloPayload),
        });

        const data = (await response.json()) as { people?: any[]; contacts?: any[] };
        const leads = data.people || data.contacts || [];
        res.json({ leads });
        return;
      }
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
      
      const searchParams: any = {
        api_key: settings.apollo_api_key,
        person_locations: location ? [location] : undefined, // ✅ Correct parameter name
        page: 1,
        per_page: 100
      };

      // Handle Boolean search mode
      if (booleanSearch && keywords) {
        // Boolean mode: Put Boolean job title search in person_titles, not q_keywords
        // Apollo supports Boolean syntax in person_titles field
        searchParams.person_titles = [keywords.trim()];
        console.log('[Apollo Search] Boolean mode enabled - using person_titles with Boolean syntax:', searchParams.person_titles);
      } else {
        // Regular mode: Use person_titles for job title and q_keywords for additional keywords
        if (jobTitle) {
          searchParams.person_titles = [jobTitle];
        }
        if (keywords) {
          searchParams.q_keywords = keywords;
        }
        console.log('[Apollo Search] Regular mode - using person_titles and q_keywords separately');
      }

      console.log('[Apollo Search] USER API KEY - Using WORKING Apollo implementation:', {
        ...searchParams,
        api_key: '***'
      });

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 4) If no shared key or OAuth, fallback to user's personal API key
    // (handled above already); if none, error out

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

    // Fire-and-forget Slack notification for CSV/Apollo lead import
    try {
      const { data: me } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const userEmail = (me as any)?.email || 'unknown@user';
      const count = Array.isArray(data) ? data.length : 0;
      const src = source || 'csv';
      notifySlack(`📥 CSV Leads Import: ${count} leads imported by ${userEmail}${src ? ` (source: ${src})` : ''}`);
    } catch (e) {
      console.warn('[Leads Import] Slack notify failed (non-fatal):', (e as any)?.message || e);
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

// POST /api/leads/bulk-add - Add scraped leads from extension with credit gating (1 credit per lead)
router.post('/bulk-add', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing leads array' });
      return;
    }

    // Normalize leads data from Sales Navigator scraping
    const normalizedLeads = leads.map((lead: any) => {
      const first = lead.first_name || (lead.name ? lead.name.split(' ')[0] : '') || '';
      const last = lead.last_name || (lead.name ? lead.name.split(' ').slice(1).join(' ') : '') || '';

      return {
        user_id: userId,
        first_name: first,
        last_name: last,
        name: lead.name || `${first} ${last}`.trim(),
        email: lead.email || '',
        title: lead.title || '',
        company: lead.company || '',
        linkedin_url: lead.profileUrl || null,
        source: 'Chrome Extension',
        enrichment_source: 'linkedin',
        enrichment_data: {
          location: lead.location || 'Unknown',
          source: 'Chrome Extension'
        },
        status: 'New',
        created_at: new Date().toISOString(),
      };
    }).filter(lead => lead.name); // Only include leads with names

    if (normalizedLeads.length === 0) {
      res.status(400).json({ error: 'No valid leads provided' });
      return;
    }

    // Check and deduct credits for Chrome extension lead scraping (1 credit per lead)
    try {
      const ok = await CreditService.hasSufficientCredits(userId, normalizedLeads.length);
      if (!ok) {
        res.status(402).json({ error: 'Insufficient credits. You need ' + normalizedLeads.length + ' credits to add these leads.' });
        return;
      }
      await CreditService.deductCredits(
        userId,
        normalizedLeads.length,
        'api_usage',
        `Chrome Extension: Scrape + import ${normalizedLeads.length} profiles`
      );
    } catch (creditError) {
      res.status(402).json({ error: 'Credit deduction failed: ' + (creditError as any)?.message || String(creditError) });
      return;
    }

    // Insert leads into the database
    const { data, error } = await supabase
      .from('leads')
      .insert(normalizedLeads)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Emit source-added events for batch imports via Chrome Extension
    try {
      const { createZapEvent, EVENT_TYPES } = await import('../lib/events');
      for (const row of (data || [])) {
        await createZapEvent({
          event_type: EVENT_TYPES.lead_source_added as any,
          user_id: req.user!.id,
          entity: 'leads',
          entity_id: row.id,
          payload: { source: 'chrome_extension' }
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      data,
      added: data?.length || 0,
      creditsCharged: normalizedLeads.length,
      message: `Successfully added ${data?.length || 0} leads and charged ${normalizedLeads.length} credits`
    });
  } catch (error) {
    console.error('Error adding leads:', error);
    res.status(500).json({ error: 'Failed to add leads' });
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

// OLD APOLLO ROUTE REMOVED - Now using Decodo-first compatibility route above

// GET /api/leads/:id - fetch a single lead by ID (with user ownership verification)
router.get('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch the lead first
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*, user_id')
      .eq('id', id)
      .single();

    if (leadErr || !lead) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    // Allow if owner; otherwise allow if same team privileged OR if this user owns a candidate linked to this lead
    if (lead.user_id !== userId) {
      const { data: me } = await supabase.from('users').select('id, role, team_id').eq('id', userId).single();
      const { data: owner } = await supabase.from('users').select('id, team_id').eq('id', lead.user_id).single();
      const role = (me as any)?.role;
      const sameTeam = (me as any)?.team_id && owner?.team_id && (me as any).team_id === owner.team_id;
      const isPrivileged = role === 'team_admin' || role === 'super_admin' || role === 'SuperAdmin';

      let hasCandidateAccess = false;
      if (!isPrivileged || !sameTeam) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('lead_id', id)
          .eq('user_id', userId)
          .single();
        hasCandidateAccess = Boolean(candidate);
      }

      if (!(isPrivileged && sameTeam) && !hasCandidateAccess) {
        res.status(404).json({ error: 'Lead not found or access denied' });
        return;
      }
    }
    
    res.json(lead);
  } catch (err) {
    console.error('Error fetching lead:', err);
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
    // Ensure an email is always present to satisfy NOT NULL + UNIQUE(email)
    const providedEmail = typeof lead.email === 'string' ? lead.email.trim() : '';
    let candidateEmail = providedEmail && providedEmail.length > 0
      ? providedEmail
      : `unknown+${(user.id || '').slice(0,8)}+${Date.now()}@noemail.hirepilot`;
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        lead_id: lead.id,
        user_id: user.id,
        first_name: firstName || '',
        last_name: lastName || '',
        email: candidateEmail,
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
      // Handle duplicate email: retry once with a unique placeholder
      if ((candidateError as any)?.code === '23505') {
        const retryEmail = `unknown+${(user.id || '').slice(0,8)}+${Date.now()}-dup@noemail.hirepilot`;
        const { data: candidate2, error: retryErr } = await supabase
          .from('candidates')
          .insert({
            lead_id: lead.id,
            user_id: user.id,
            first_name: firstName || '',
            last_name: lastName || '',
            email: retryEmail,
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
          .maybeSingle();
        if (retryErr || !candidate2) {
          res.status(500).json({ error: 'db error', details: retryErr || candidateError });
          return;
        }
        // Use candidate2 in downstream analytics
      } else {
        res.status(500).json({ error: 'db error', details: candidateError });
        return;
      }
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

    // Sanitize and map incoming payload to allowed DB columns (avoid camelCase like createdAt)
    const body = (req.body || {}) as any;
    const updatePayload: any = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.company !== undefined) updatePayload.company = body.company;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.linkedin_url !== undefined) updatePayload.linkedin_url = body.linkedin_url;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.tags !== undefined) updatePayload.tags = body.tags;
    if (body.location !== undefined) updatePayload.location = body.location;
    updatePayload.updated_at = new Date().toISOString();

    // Update the lead, handling unique email conflicts gracefully
    let { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();

    if (error && (error as any)?.code === '23505' && req.body?.email) {
      // If the email conflicts, return a clear 409 for the frontend to display
      res.status(409).json({ error: 'lead_email_exists', message: 'A lead with this email already exists.' });
      return;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Sync changes to the corresponding candidate record if it exists
    try {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('lead_id', id)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (candidate) {
        const candidateUpdate: any = {};
        if (req.body.first_name !== undefined) candidateUpdate.first_name = req.body.first_name;
        if (req.body.last_name !== undefined) candidateUpdate.last_name = req.body.last_name;
        if (req.body.email !== undefined) candidateUpdate.email = req.body.email;
        if (req.body.phone !== undefined) candidateUpdate.phone = req.body.phone;
        
        // Only update candidate if there are fields to sync
        if (Object.keys(candidateUpdate).length > 0) {
          await supabase
            .from('candidates')
            .update(candidateUpdate)
            .eq('id', candidate.id)
            .eq('user_id', req.user.id);
        }
      }
    } catch (candidateSyncError) {
      console.warn('Failed to sync lead update to candidate:', candidateSyncError);
      // Don't fail the lead update if candidate sync fails
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

        // If tags changed, emit dedicated tag-added events for any newly added tags
        if (Array.isArray(req.body.tags) && JSON.stringify(req.body.tags) !== JSON.stringify(originalLead.tags)) {
          const prev = new Set<string>((originalLead.tags || []) as any);
          const next = new Set<string>((req.body.tags || []) as any);
          const added: string[] = [];
          next.forEach((t: string) => { if (!prev.has(t)) added.push(t); });
          added.forEach((tag) => {
            try { emitZapEvent({
              userId: req.user!.id,
              eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
              eventData: createLeadEventData(data, { tag, action: 'tag_added' }),
              sourceTable: 'leads',
              sourceId: data.id
            }); } catch {}
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

// Add PATCH/PUT routes for lead updates (compat with frontend)
router.patch('/:id', requireAuth, updateLead);
router.put('/:id', requireAuth, updateLead);
// Add DELETE route for single-lead deletion
router.delete('/:id', requireAuth, deleteLead);

// Attach leads to campaign endpoint
router.post('/attach-to-campaign', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { leadIds, campaignId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lead IDs are required'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    // Verify that the user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, title')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or access denied'
      });
    }

    // Normalize and validate leadIds
    const ids: string[] = Array.from(new Set((leadIds as any[]).map((x) => String(x).trim())));
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter((id) => !uuidRe.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid leadIds provided: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '…' : ''}`
      });
    }

    // Verify that the user owns all the leads (chunked to avoid query limits)
    let ownedIds: string[] = [];
    const chunkSize = 900; // safe margin under PostgREST parameter limits
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data: chunkRows, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .in('id', chunk)
        .eq('user_id', userId);
      if (leadsError) {
        return res.status(500).json({ success: false, error: `Failed to verify lead ownership: ${leadsError.message}` });
      }
      ownedIds = ownedIds.concat((chunkRows || []).map((r: any) => r.id));
    }

    if (ownedIds.length !== ids.length) {
      return res.status(403).json({
        success: false,
        error: 'Some leads not found or access denied'
      });
    }

    // Update the campaign_id for all the leads
    const nowIso = new Date().toISOString();
    for (let i = 0; i < ownedIds.length; i += chunkSize) {
      const chunk = ownedIds.slice(i, i + chunkSize);
      const { error: updateError } = await supabase
        .from('leads')
        .update({ campaign_id: campaignId, updated_at: nowIso })
        .in('id', chunk)
        .eq('user_id', userId);
      if (updateError) {
        console.error('Error updating leads:', updateError);
        return res.status(500).json({ success: false, error: `Failed to attach leads to campaign: ${updateError.message}` });
      }
    }

    // If the campaign is currently in draft, flip it to active
    try {
      const { data: c, error: fetchCampaignStatusErr } = await supabase
        .from('campaigns')
        .select('id, status')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single();
      if (!fetchCampaignStatusErr && c && (c as any).status === 'draft') {
        const { error: setActiveErr } = await supabase
          .from('campaigns')
          .update({ status: 'active' })
          .eq('id', campaignId)
          .eq('user_id', userId);
        if (setActiveErr) {
          console.warn('Failed to auto-activate campaign after attaching leads:', setActiveErr);
        }
      }
    } catch (e) {
      console.warn('Non-fatal: could not set campaign active after attaching leads', e);
    }

    res.json({
      success: true,
      message: `Successfully attached ${ids.length} lead(s) to campaign`,
      campaignName: campaign.name || campaign.title,
      attachedLeads: ids.length
    });

  } catch (error) {
    console.error('Error in attach-to-campaign endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 