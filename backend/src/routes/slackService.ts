import { WebClient } from '@slack/web-api';
import { createClient } from '@supabase/supabase-js';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function sendToSlack(name: string, email: string, message: string, sessionId: string) {
  try {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID!,
      text: `New live chat message (Session: ${sessionId}) from ${name} (${email}):\n${message}`,
      unfurl_links: false,
      unfurl_media: false,
    });

    await supabase.from('live_chat_messages').insert({
      session_id: sessionId,
      sender: 'user',
      text: message,
      name,
      email,
    });
  } catch (error) {
    console.error('Slack send error:', error);
    throw error;
  }
}

export async function getMessages(sessionId: string) {
  try {
    const { data } = await supabase
      .from('live_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    return data || [];
  } catch (error) {
    console.error('Get messages error:', error);
    return [];
  }
}

export async function storeTeamReply(sessionId: string, text: string) {
  try {
    await supabase.from('live_chat_messages').insert({
      session_id: sessionId,
      sender: 'team',
      text,
    });
  } catch (error) {
    console.error('Store team reply error:', error);
  }
}

export function extractSessionId(text: string): string | null {
  const match = text && text.match(/\[session:\s*([0-9a-f-]{36})\]/i);
  return match ? match[1] : null;
}


