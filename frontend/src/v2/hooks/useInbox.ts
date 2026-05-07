/**
 * v2 — useInbox
 * Recent email_replies with joined lead context, via /api/v2/inbox.
 */

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export interface InboxThread {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  classification: string | null;
  classified_at: string | null;
  sender_email: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  created_at: string | null;
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    title: string | null;
    company: string | null;
    linkedin_url: string | null;
    status: string | null;
  } | null;
}

export function useInbox(limit = 30) {
  const query = useQuery({
    queryKey: ['v2', 'inbox', limit],
    queryFn: () => apiGet(`/api/v2/inbox?limit=${limit}`) as Promise<{ threads: InboxThread[] }>,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  return {
    threads: query.data?.threads ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
