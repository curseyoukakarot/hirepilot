import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function launchCampaign(req: Request, res: Response) {
  try {
    const { campaign_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: 'Missing campaign_id' });
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (fetchError) {
      console.error('[Launch Campaign Error]', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft campaigns can be launched' });
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: 'active', launched_at: new Date().toISOString() })
      .eq('id', campaign_id);

    if (updateError) {
      console.error('[Launch Campaign Error]', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.status(200).json({ message: 'Campaign launched successfully' });
  } catch (error: any) {
    console.error('[Launch Campaign Error]', error);
    return res.status(500).json({ error: error.message || 'Failed to launch campaign' });
  }
} 