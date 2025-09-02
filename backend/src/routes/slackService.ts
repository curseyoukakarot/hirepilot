import { WebClient } from '@slack/web-api';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let slack: WebClient | null = null;
let supabase: SupabaseClient | null = null;

function getSlack(): WebClient | null {
  if (!slack) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      console.warn('[live-chat] SLACK_BOT_TOKEN not set; Slack posts will be skipped');
      return null;
    }
    slack = new WebClient(token);
  }
  return slack;
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || (process.env as any).SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      throw new Error('[live-chat] Supabase env missing (SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY required)');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function sendToSlack(name: string, email: string, message: string, sessionId: string) {
  try {
    const slackClient = getSlack();
    let parentTs: string | undefined;
    if (slackClient && process.env.SLACK_CHANNEL_ID) {
      const post = await slackClient.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `New live chat message (Session: ${sessionId}) from ${name} (${email}):\n${message}`,
        unfurl_links: false,
        unfurl_media: false,
      });
      parentTs = (post as any)?.ts as string | undefined;
      // Upsert live session mapping so Slack Events can correlate thread replies back to the widget session
      try {
        await getSupabase().from('rex_live_sessions').upsert({
          widget_session_id: sessionId,
          user_name: name || null,
          user_email: email || null,
          slack_channel_id: process.env.SLACK_CHANNEL_ID!,
          slack_thread_ts: parentTs || null,
        }, { onConflict: 'widget_session_id' });
      } catch (e) {
        console.warn('[live-chat] rex_live_sessions upsert failed (table missing or perms?)', e);
      }
    }

    await getSupabase().from('live_chat_messages').insert({
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
    const { data } = await getSupabase()
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
    await getSupabase().from('live_chat_messages').insert({
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


