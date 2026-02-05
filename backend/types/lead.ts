export interface Lead {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  linkedin?: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified';
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  enrichment_source?: 'brightdata' | 'apollo' | 'skrapp' | 'decodo' | null;
  enrichment_status?: 'pending' | 'succeeded' | 'failed' | null;
  enrichment_error?: string | null;
  email_status?: 'pending' | 'found' | 'not_found' | null;
  email_source?: 'apollo' | 'skrapp' | null;
  enrichment_keywords?: string[] | null;
  brightdata_raw?: any | null;
  persona_type?: string | null;
} 