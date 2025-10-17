export type PersonaRow = {
  id: string;
  user_id: string;
  name: string;
  titles: string[] | null;
  include_keywords: string[] | null;
  exclude_keywords: string[] | null;
  locations: string[] | null;
  channels: string[] | null;
  goal_total_leads: number | null;
  stats: any;
  created_at: string;
  updated_at: string;
};

export type ScheduleRow = {
  id: string;
  user_id: string;
  name: string;
  action_type: 'source_via_persona' | 'launch_campaign' | 'send_sequence';
  persona_id: string | null;
  campaign_id: string | null;
  payload: any;
  schedule_kind: 'one_time' | 'recurring';
  cron_expr: string | null;
  run_at: string | null;
  next_run_at: string | null;
  status: 'active' | 'paused';
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};


