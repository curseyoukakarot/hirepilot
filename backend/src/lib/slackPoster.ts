import axios from 'axios';
import { supabase } from './supabase';

export async function postToSlack(userIdOrSlackId: string, text: string, channel?: string) {
  // Determine search column: if starts with 'U' (Slack user IDs) use slack_user_id, else user_id
  const isSlackId = /^U[A-Z0-9]{8,}$/.test(userIdOrSlackId);
  const column = isSlackId ? 'slack_user_id' : 'user_id';

  let { data, error } = await supabase
    .from('slack_accounts')
    .select('access_token, channel_name')
    .eq(column, userIdOrSlackId)
    .maybeSingle();

  // Fallback: look up by the other column
  if ((!data || error) && isSlackId) {
    ({ data, error } = await supabase
      .from('slack_accounts')
      .select('access_token, channel_name')
      .eq('user_id', userIdOrSlackId) // unlikely but fallback
      .maybeSingle());
  }

  if (!data || error) throw new Error('Slack not connected');

  const token = data.access_token;
  const channelName = channel || data.channel_name;
  if (!channelName) throw new Error('No Slack channel');

  await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel: channelName, text },
    { headers: { Authorization: `Bearer ${token}` } }
  );
} 