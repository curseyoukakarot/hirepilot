import type { ProspectProfile } from './linkedinActions';

export type ProviderName = 'airtop' | 'local_playwright' | 'agentic_browser';

export type JobListing = {
  job_url: string;
  title?: string | null;
  company?: string | null;
  company_url?: string | null;
  location?: string | null;
};

export type DecisionMakerResult = {
  profile_url: string;
  name?: string | null;
  headline?: string | null;
  company_name?: string | null;
  company_url?: string | null;
};

export type LinkedInAuthStartResult =
  | {
      provider: 'airtop';
      auth_session_id: string;
      airtop_session_id: string;
      airtop_window_id: string;
      airtop_profile_id: string;
      live_view_url: string;
    }
  | {
      provider: 'agentic_browser';
      auth_session_id: string;
      browserbase_session_id: string;
      browserbase_context_id: string;
      live_view_url: string;
    };

export type ActionDebugContext = { jobId?: string | null; enabled?: boolean };

export type SendConnectResult =
  | { status: 'sent_verified' | 'already_connected' | 'already_pending' | 'restricted' | 'skipped' | 'failed' | 'failed_verification'; details?: any };

export type SendMessageResult =
  | { status: 'sent_verified' | 'not_1st_degree' | 'skipped' | 'failed' | 'failed_verification'; details?: any };

export type SendInMailResult =
  | { status: 'sent_verified' | 'no_inmail_credits' | 'not_available' | 'failed'; details?: any };

export interface SniperExecutionProvider {
  name: ProviderName;
  startLinkedInAuth?(args: { userId: string; workspaceId: string }): Promise<LinkedInAuthStartResult>;
  completeLinkedInAuth?(args: { userId: string; workspaceId: string; authSessionId: string }): Promise<{ ok: true; airtop_profile_id: string }>;

  prospectPostEngagers(args: { userId: string; workspaceId: string; postUrl: string; limit: number }): Promise<ProspectProfile[]>;
  prospectPeopleSearch(args: { userId: string; workspaceId: string; searchUrl: string; limit: number }): Promise<ProspectProfile[]>;
  prospectJobsIntent(args: { userId: string; workspaceId: string; searchUrl: string; limit: number }): Promise<JobListing[]>;
  prospectDecisionMakers(args: { userId: string; workspaceId: string; companyUrl: string; companyName?: string | null; jobTitle?: string | null; limit: number }): Promise<DecisionMakerResult[]>;
  sendConnectionRequest(args: { userId: string; workspaceId: string; profileUrl: string; note?: string | null; debug?: ActionDebugContext }): Promise<SendConnectResult>;
  sendMessage(args: { userId: string; workspaceId: string; profileUrl: string; message: string; debug?: ActionDebugContext }): Promise<SendMessageResult>;

  // Sales Navigator methods
  prospectSalesNavSearch(args: { userId: string; workspaceId: string; searchUrl: string; limit: number }): Promise<ProspectProfile[]>;
  sendSalesNavConnect(args: { userId: string; workspaceId: string; profileUrl: string; note?: string | null; debug?: ActionDebugContext }): Promise<SendConnectResult>;
  sendSalesNavInMail(args: { userId: string; workspaceId: string; profileUrl: string; subject: string; message: string; debug?: ActionDebugContext }): Promise<SendInMailResult>;
  sendSalesNavMessage(args: { userId: string; workspaceId: string; profileUrl: string; message: string; debug?: ActionDebugContext }): Promise<SendMessageResult>;
}


