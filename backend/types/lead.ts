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
} 