// backend/api/saveCampaign.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function saveCampaign(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, campaignName, jobReq, keywords, status } = req.body;

  if (!user_id || !campaignName || !jobReq) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // First, check if user exists
    const { data: users, error: userError } = await supabaseDb
      .from('users')
      .select('id')
      .eq('id', user_id);

    if (userError) {
      console.error('[saveCampaign] User check error:', userError);
      return res.status(500).json({ error: 'Error checking user' });
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
        return res.status(500).json({ error: 'Error creating user' });
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
      return res.status(500).json({ error: jobError.message });
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
      return res.status(500).json({ error: campaignError.message });
    }

    console.log('[saveCampaign] Campaign saved:', campaignData);

    return res.status(200).json({ 
      campaign: campaignData,
      job: jobData,
      keywords: campaignData.keywords
    });
  } catch (err: any) {
    console.error('[saveCampaign] Server Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
