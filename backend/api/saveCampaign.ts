// backend/api/saveCampaign.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function saveCampaign(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { user_id, campaignName, jobReq, keywords, status } = req.body;

  // Allow skipping job description. Only require user_id and campaignName.
  if (!user_id || !campaignName) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // First, check if user exists
    const { data: users, error: userError } = await supabaseDb
      .from('users')
      .select('id')
      .eq('id', user_id);

    if (userError) {
      console.error('[saveCampaign] User check error:', userError);
      res.status(500).json({ error: 'Error checking user' });
      return;
    }

    // If user doesn't exist, create them
    if (!users || users.length === 0) {
      const { data: newUser, error: createUserError } = await supabaseDb
        .from('users')
        .insert([{ id: user_id }])
        .select()
        .single();

      if (createUserError) {
        console.error('[saveCampaign] User creation error:', createUserError);
        res.status(500).json({ error: 'Error creating user' });
        return;
      }
    }

    // Optionally create the job requisition when a JD is provided
    let jobData: any = null;
    if (jobReq && String(jobReq).trim().length > 0) {
      const jobIns = await supabaseDb
        .from('job_requisitions')
        .insert([
          {
            user_id,
            title: campaignName,
            description: jobReq,
            status: status || 'draft'
          }
        ])
        .select()
        .single();
      if (jobIns.error) {
        console.error('[saveCampaign] Job creation error:', jobIns.error);
        res.status(500).json({ error: jobIns.error.message });
        return;
      }
      jobData = jobIns.data;
    }

    // Create the campaign
    const { data: campaignData, error: campaignError } = await supabaseDb
      .from('campaigns')
      .insert([
        {
          user_id,
          title: campaignName,
          description: jobReq || null,
          status: status || 'draft',
          job_id: jobData?.id || null,
          keywords: keywords || null
        }
      ])
      .select()
      .single();

    if (campaignError) {
      console.error('[saveCampaign] Campaign creation error:', campaignError);
      res.status(500).json({ error: 'Failed to save campaign' });
      return;
    }

    console.log('[saveCampaign] Campaign saved:', campaignData);

    // Emit campaign created event
    await import('../lib/zapEventEmitter').then(({ emitZapEvent, ZAP_EVENT_TYPES, createCampaignEventData }) => {
      emitZapEvent({
        userId: user_id,
        eventType: ZAP_EVENT_TYPES.CAMPAIGN_CREATED,
        eventData: createCampaignEventData(campaignData, { job_id: jobData?.id || null }),
        sourceTable: 'campaigns',
        sourceId: campaignData.id
      });
    });

    // Notify Slack (site-wide)
    try {
      const { notifySlack } = await import('../lib/slack');
      // Fetch user email
      const { data: userRow } = await supabaseDb.from('users').select('email').eq('id', user_id).single();
      await notifySlack(`🚀 New campaign *${campaignName}* created by ${userRow?.email || user_id}`);
    } catch (slackErr) {
      console.warn('[saveCampaign] Slack notify failed', slackErr);
    }

    // --------------------------------------------------
    // Update REX context so chat knows the latest campaign
    // --------------------------------------------------
    try {
      const { updateREXContext } = await import('../src/api/hooks/updateUserContext');
      await updateREXContext({
        supabase_user_id: user_id,
        latest_campaign_id: campaignData.id
      });
    } catch (ctxErr) {
      console.warn('[saveCampaign] Failed to update REX context', ctxErr);
    }

    res.status(200).json({ 
      campaign: campaignData,
      job: jobData,
      keywords: campaignData.keywords
    });
  } catch (err: any) {
    console.error('[saveCampaign] Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
}
