import { Request, Response } from 'express';
import { supabase, supabaseDb } from '../lib/supabase';

export default async function deleteCampaign(req: Request, res: Response) {
  try {
    const { campaign_id } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!campaign_id) {
      res.status(400).json({ error: 'Missing campaign ID' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized - Missing user ID' });
      return;
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
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Delete the campaign (no user_id filter – we already verified ownership)
    const { error, count } = await supabaseDb
      .from('campaigns')
      .delete({ count: 'exact' })
      .eq('id', campaign_id);

    if (error) {
      console.error('[Delete Campaign Error]', error);
      res.status(500).json({ error: 'Failed to delete campaign' });
      return;
    }

    if ((count ?? 0) === 0) {
      res.status(404).json({ error: 'Campaign not found or already deleted' });
      return;
    }

    res.status(200).json({ message: 'Campaign deleted successfully' });
    return;
  } catch (err) {
    console.error('[Delete Campaign Exception]', err);
    res.status(500).json({ error: 'Server error' });
    return;
  }
}
