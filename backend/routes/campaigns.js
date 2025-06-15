// Get campaign performance metrics
router.get('/:campaignId/performance', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;

    // Get total emails sent for this campaign
    const { data: sentEmails, error: sentError } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .eq('event_type', 'delivered');

    if (sentError) throw sentError;

    // Get total opens for this campaign
    const { data: opens, error: opensError } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .eq('event_type', 'open');

    if (opensError) throw opensError;

    // Get total replies for this campaign
    const { data: replies, error: repliesError } = await supabase
      .from('email_tracking_events')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .eq('event_type', 'reply');

    if (repliesError) throw repliesError;

    // Get total leads and converted candidates
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('total_leads, converted_candidates')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError) throw campaignError;

    res.json({
      sent: sentEmails?.length || 0,
      opens: opens?.length || 0,
      replies: replies?.length || 0,
      total_leads: campaign?.total_leads || 0,
      converted_candidates: campaign?.converted_candidates || 0
    });
  } catch (error) {
    console.error('Error fetching campaign performance:', error);
    res.status(500).json({ error: 'Failed to fetch campaign performance' });
  }
}); 