// backend/api/saveCampaign.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function saveCampaign(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { user_id, campaignName, jobReq, keywords, status } = req.body;

  if (!user_id || !campaignName || !jobReq) {
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

    // Create the job requisition
    const { data: jobData, error: jobError } = await supabaseDb
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

    if (jobError) {
      console.error('[saveCampaign] Job creation error:', jobError);
      res.status(500).json({ error: jobError.message });
      return;
    }

    // Create the campaign
    const { data: campaignData, error: campaignError } = await supabaseDb
      .from('campaigns')
      .insert([
        {
          user_id,
          title: campaignName,
          description: jobReq,
          status: status || 'draft',
          job_id: jobData.id,
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
