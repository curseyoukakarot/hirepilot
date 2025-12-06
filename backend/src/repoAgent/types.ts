import type { SupabaseClient } from '@supabase/supabase-js';

export type HealthStatus = 'pass' | 'fail' | 'warn';
export type SeverityLevel = 'low' | 'medium' | 'high';

export interface HealthCheckRunResult {
  testsStatus: HealthStatus;
  lintStatus: HealthStatus;
  buildStatus: HealthStatus;
  severity: SeverityLevel;
  logsTests: string;
  logsLint: string;
  logsBuild: string;
  summary: string;
  branch: string;
}

export interface ScenarioContext {
  supabase: SupabaseClient;
}

export type ScenarioStatus = 'pass' | 'fail' | 'never_run' | 'running';

export interface ScenarioResult {
  status: ScenarioStatus;
  failingStep?: string;
  logs?: string;
}

export type SweepStatus = 'clean' | 'violations' | 'never_run' | 'running';

export interface SweepResult {
  status: SweepStatus;
  violationSummary?: string;
  rawReport?: string;
  violationCount?: number;
}

export interface DiffChunk {
  path: string;
  diff: string;
  description?: string;
}

export type RepoAgentMessageRole = 'user' | 'agent' | 'system';

export interface RepoAgentMessage {
  id: string;
  conversationId: string;
  role: RepoAgentMessageRole;
  content: string;
  createdAt: string;
}

export interface RepoAgentConversation {
  id: string;
  createdAt: string;
  createdByUserId?: string | null;
  title?: string | null;
  relatedErrorId?: string | null;
  relatedHealthCheckId?: string | null;
  relatedScenarioRunId?: string | null;
  relatedSweepRunId?: string | null;
  messages: RepoAgentMessage[];
}

export interface RepoAgentSettings {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  slackEnabled: boolean;
  slackChannel?: string | null;
  slackWebhookUrl?: string | null;
  emailEnabled: boolean;
  emailRecipients: string[];
  nightlyCheckEnabled: boolean;
  nightlyCheckTimeUtc: string;
  errorAlertThreshold: number;
}

export interface HealthCheckNotificationPayload {
  healthCheckId: string;
  summary: string;
  severity: SeverityLevel;
  branch: string;
  triggeredBy: 'system' | 'user';
}

export interface ErrorAlertPayload {
  errorId: string;
  signature: string;
  message: string;
  occurrences: number;
  status: 'open' | 'fixing' | 'resolved';
}

export interface ScenarioAlertPayload {
  scenarioRunId: string;
  scenarioName: string;
  failingStep?: string;
  logs?: string;
}

export interface SweepAlertPayload {
  sweepRunId: string;
  sweepName: string;
  violationSummary?: string;
  violationCount?: number;
}

export type PatchStatus = 'proposed' | 'applied' | 'failed';

export interface StoredPatch {
  id: string;
  relatedErrorId?: string;
  relatedHealthCheckId?: string;
  relatedScenarioRunId?: string;
  relatedSweepRunId?: string;
  status: PatchStatus;
  diffs: DiffChunk[];
  summary?: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
}

