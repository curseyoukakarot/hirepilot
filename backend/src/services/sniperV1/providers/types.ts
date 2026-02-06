import type { ProspectProfile } from './linkedinActions';

export type ProviderName = 'airtop' | 'local_playwright';

export type JobListing = {
  job_url: string;
  title?: string | null;
  company?: string | null;
  company_url?: string | null;
  location?: string | null;
};

export type LinkedInAuthStartResult = {
  provider: 'airtop';
  auth_session_id: string;
  airtop_session_id: string;
  airtop_window_id: string;
  airtop_profile_id: string;
  live_view_url: string;
};

export type ActionDebugContext = { jobId?: string | null; enabled?: boolean };

export type SendConnectResult =
  | { status: 'sent_verified' | 'already_connected' | 'already_pending' | 'restricted' | 'skipped' | 'failed' | 'failed_verification'; details?: any };

export type SendMessageResult =
  | { status: 'sent_verified' | 'not_1st_degree' | 'skipped' | 'failed' | 'failed_verification'; details?: any };

export interface SniperExecutionProvider {
  name: ProviderName;
  startLinkedInAuth?(args: { userId: string; workspaceId: string }): Promise<LinkedInAuthStartResult>;
  completeLinkedInAuth?(args: { userId: string; workspaceId: string; authSessionId: string }): Promise<{ ok: true; airtop_profile_id: string }>;

  prospectPostEngagers(args: { userId: string; workspaceId: string; postUrl: string; limit: number }): Promise<ProspectProfile[]>;
  prospectPeopleSearch(args: { userId: string; workspaceId: string; searchUrl: string; limit: number }): Promise<ProspectProfile[]>;
  prospectJobsIntent(args: { userId: string; workspaceId: string; searchUrl: string; limit: number }): Promise<JobListing[]>;
  sendConnectionRequest(args: { userId: string; workspaceId: string; profileUrl: string; note?: string | null; debug?: ActionDebugContext }): Promise<SendConnectResult>;
  sendMessage(args: { userId: string; workspaceId: string; profileUrl: string; message: string; debug?: ActionDebugContext }): Promise<SendMessageResult>;
}


