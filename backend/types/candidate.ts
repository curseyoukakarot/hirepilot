export interface Candidate {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  company?: string | null;
  linkedin_url?: string | null;
  enrichment_source?: 'brightdata' | 'apollo' | 'skrapp' | 'decodo' | null;
  enrichment_status?: 'pending' | 'succeeded' | 'failed' | null;
  enrichment_error?: string | null;
  email_status?: 'pending' | 'found' | 'not_found' | null;
  email_source?: 'apollo' | 'skrapp' | null;
  brightdata_raw?: any | null;
  enrichment_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

