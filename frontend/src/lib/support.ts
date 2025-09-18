import { apiPost } from './api';

export type SupportTicket = {
  id: string;
  user_id: string | null;
  query: string;
  status: string;
  created_at: string;
};

export async function createSupportTicketClient(query: string, userId: string | null): Promise<SupportTicket> {
  // Uses frontend API proxy which will call backend to insert + Slack notify
  return apiPost('/api/support/create', { query, userId }, { requireAuth: false });
}

export type SupportSearchResult = {
  id: string;
  type: 'tool' | 'faq' | 'blog' | 'plan';
  title: string | null;
  content: string | null;
  restricted: boolean | null;
  similarity: number;
};

export async function searchSupportKnowledge(query: string, limit = 5): Promise<SupportSearchResult[]> {
  const res = await apiPost('/api/support/search', { query, limit }, { requireAuth: false });
  return res.results || [];
}


