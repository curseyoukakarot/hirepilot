/**
 * Shared types for the REX skill registry.
 * Kept separate to avoid import cycles between handlers and registry.
 */

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
