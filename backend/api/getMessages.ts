// backend/api/getMessages.ts
import { supabase } from '../lib/supabase';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaign_id = url.searchParams.get('campaign_id');

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaign_id)
      .order('day', { ascending: true });

    if (error) {
      console.error('[getMessages Error]', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ messages: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[getMessages Catch]', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unexpected server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
