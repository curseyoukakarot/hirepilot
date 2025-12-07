export interface SniperJob {
  id: string;
  user_id: string;
  account_id?: string | null;
  campaign_id?: string | null;
  session_id?: string | null;
  source?: string | null;
  action?: string | null;
  status: string;
  payload?: Record<string, unknown>;
  brightdata_raw?: any | null;
  source_url?: string | null;
  source_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

