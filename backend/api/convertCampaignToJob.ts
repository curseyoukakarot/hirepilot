import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function convertCampaignToJob(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { campaign_id } = req.body;

  if (!campaign_id) {
    res.status(400).json({ error: 'Missing campaign_id' });
    return;
  }

  try {
    // Get the campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError) {
      console.error('[convertCampaignToJob] Campaign fetch error:', campaignError);
      res.status(500).json({ error: campaignError.message });
      return;
    }

    // Create a job requisition
    const { data: jobData, error: jobError } = await supabase
      .from('job_requisitions')
      .insert([
        {
          user_id: campaign.user_id,
          title: campaign.title,
          description: campaign.description,
          status: 'open',
          department: 'TBD', // You might want to add these fields to the campaign
          location: 'Remote', // You might want to add these fields to the campaign
          salary_range: 'TBD' // You might want to add these fields to the campaign
        }
      ])
      .select()
      .single();

    if (jobError) {
      console.error('[convertCampaignToJob] Job creation error:', jobError);
      res.status(500).json({ error: jobError.message });
      return;
    }

    // Update the campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'converted',
        job_id: jobData.id
      })
      .eq('id', campaign_id);

    if (updateError) {
      console.error('[convertCampaignToJob] Campaign update error:', updateError);
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.status(200).json({ 
      message: 'Campaign converted to job successfully',
      job: jobData
    });
  } catch (err: any) {
    console.error('[convertCampaignToJob] Server Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
    return;
  }
} 