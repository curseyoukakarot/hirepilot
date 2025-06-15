export type CampaignStatus = 'draft' | 'enriching' | 'active' | 'paused' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
  total_leads: number;
  enriched_leads: number;
  error_message?: string;
}

export interface Lead {
  id: string;
  campaign_id: string;
  apollo_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  email_status: string;
  is_unlocked: boolean;
  is_gdpr_locked: boolean;
  title: string;
  company: string;
  linkedin_url?: string;
  city: string;
  state: string;
  country: string;
  created_at: string;
  updated_at: string;
} 