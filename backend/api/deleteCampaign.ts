import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function deleteCampaign(req: Request, res: Response) {
  try {
    const { campaign_id } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!campaign_id) {
      return res.status(400).json({ error: 'Missing campaign_id' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Missing user ID' });
    }

    // First verify the campaign belongs to the user
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaign_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !campaign) {
      console.error('[Delete Campaign Error] Campaign not found or unauthorized:', fetchError);
      return res.status(404).json({ error: 'Campaign not found or unauthorized' });
    }

    // Delete the campaign
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign_id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Delete Campaign Error]', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    console.error('[Delete Campaign Exception]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
