// backend/api/deleteCampaign.ts

import { supabase } from '../../lib/supabaseClient';

export async function DELETE(req: Request) {
  try {
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id' }), { status: 400 });
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaign_id);

    if (error) {
      console.error('[Delete Campaign Error]', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ message: 'Campaign deleted successfully' }), { status: 200 });
  } catch (err) {
    console.error('[Delete Campaign Exception]', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
