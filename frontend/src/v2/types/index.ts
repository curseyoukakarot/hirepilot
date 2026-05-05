// v2 — shared TypeScript types matching the /api/v2 backend shape.

export type AgentRole =
  | 'sourcer'
  | 'recruiter'
  | 'coordinator'
  | 'researcher'
  | 'business_dev'
  | 'closer'
  | 'account_manager'
  | 'reference_checker';

export type TrustLevel = 'manual' | 'suggest' | 'autopilot';

export type GoalStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DecisionType =
  | 'reply_draft'
  | 'scale_recommendation'
  | 'guardrail_override'
  | 'offer_send'
  | 'pipeline_move'
  | 'submittal_send'
  | 'custom';

export type DecisionStatus = 'pending' | 'approved' | 'edited' | 'rejected' | 'snoozed' | 'graduated';

export type TeamColor =
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'teal'
  | 'slate'
  | 'violet'
  | 'sky';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  integration_id: string | null;
  agent_role: AgentRole;
  default_installed: boolean;
  icon: string | null;
  schedule_capable: boolean;
}

export interface InstalledSkill {
  agent_id: string;
  skill_id: string;
  enabled: boolean;
  schedule_cron: string | null;
  config: Record<string, any>;
  installed_at: string;
  last_run_at: string | null;
  skills_catalog?: Skill;
}

export interface Agent {
  id: string;
  workspace_id: string;
  role: AgentRole;
  display_name: string | null;
  trust_level: TrustLevel;
  paused: boolean;
  hired_by: string | null;
  hired_at: string;
  config: Record<string, any>;
  skills?: InstalledSkill[];
}

export interface Goal {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  prompt: string | null;
  plan: any | null;
  status: GoalStatus;
  trust_level: TrustLevel;
  recurring: boolean;
  schedule_cron: string | null;
  parent_goal_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface Decision {
  id: string;
  workspace_id: string;
  goal_id: string | null;
  agent_id: string | null;
  type: DecisionType;
  context: any;
  payload: any;
  reason: string | null;
  status: DecisionStatus;
  assigned_to: string | null;
  resolution: any | null;
  resolved_by: string | null;
  resolved_at: string | null;
  graduated_rule: any | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface WorkspaceSettings {
  team_id?: string;
  workspace_name: string | null;
  team_color: TeamColor;
  default_trust_level: TrustLevel;
  autopilot_score_threshold: number;
  autopilot_max_spend_per_run_cents: number;
  share_leads: boolean;
  share_candidates: boolean;
  share_deals: boolean;
  share_analytics: boolean;
  allow_team_editing: boolean;
}
