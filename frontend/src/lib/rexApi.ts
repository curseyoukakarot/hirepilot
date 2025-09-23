import { supabase } from './supabaseClient';

export type RexConversation = {
  id: string;
  user_id: string;
  title: string | null;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type RexMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: any;
  created_at: string;
};

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

export async function listConversations(): Promise<RexConversation[]> {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/conversations`, {
    headers: await authHeaders()
  });
  const data = await res.json();
  return data.conversations || [];
}

export async function createConversation(title?: string): Promise<RexConversation> {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/conversations`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ title })
  });
  const data = await res.json();
  return data.conversation;
}

export async function fetchMessages(conversationId: string): Promise<RexMessage[]> {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/conversations/${conversationId}/messages`, {
    headers: await authHeaders()
  });
  const data = await res.json();
  return data.messages || [];
}

export async function postMessage(conversationId: string, role: RexMessage['role'], content: any): Promise<RexMessage> {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/rex/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ role, content })
  });
  const data = await res.json();
  return data.message;
}


// v2 streaming API (frontend contract)
import { streamFetch } from '../hooks/useStream'

export type ChatPart = { role: 'user'|'assistant'; content: string }

export async function* chatStream(parts: ChatPart[]) {
  try {
    const base = import.meta.env.VITE_BACKEND_URL || ''
    const url = `${base}/api/rex/chat`
    const headers = await authHeaders()
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    for await (const chunk of streamFetch(url, { userId, messages: parts }, { headers })) {
      yield chunk
    }
  } catch (e) {
    // DEV FALLBACK: simple assistant text only (no fake status/search)
    const fallback = 'Hi! I\'m REX. Ask me to search or help with recruiting tasks.'
    for (const ch of fallback) {
      await new Promise(r=>setTimeout(r, 12))
      yield ch
    }
  }
}

