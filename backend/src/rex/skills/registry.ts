/**
 * REX skill registry — maps skills_catalog.id → handler.
 *
 * Each handler is a thin wrapper over an existing HirePilot service or rexTool.
 * REX (and specialist agents) call into this registry to invoke a Skill,
 * with autopilot guardrails applied at call time.
 *
 * Adding a new Skill:
 *   1. INSERT into skills_catalog (id, agent_role, ...)
 *   2. Drop a handler file under ./handlers
 *   3. Register it below in SKILL_HANDLERS
 *
 * The registry is intentionally pluggable so we can ship Skills incrementally
 * without touching rex/server.ts on every release.
 */

import type { AgentRole, TrustLevel } from './types';
import * as sourcerHandlers from './handlers/sourcer';
import * as recruiterHandlers from './handlers/recruiter';
import * as coordinatorHandlers from './handlers/coordinator';
import * as researcherHandlers from './handlers/researcher';
import * as businessDevHandlers from './handlers/business_dev';
import * as closerHandlers from './handlers/closer';
import * as accountManagerHandlers from './handlers/account_manager';
import * as referenceCheckerHandlers from './handlers/reference_checker';

export interface SkillContext {
  workspaceId: string;
  userId: string;
  agentId: string;
  agentRole: AgentRole;
  trustLevel: TrustLevel;
  /** When in autopilot, only side-effects under this score are auto-executed. */
  autopilotScoreThreshold: number;
  /** Cap on auto-spend in cents per single REX run when in autopilot. */
  autopilotMaxSpendCents: number;
}

export interface SkillResult {
  ok: boolean;
  /** When autopilot guardrails hold the action back, REX writes a `decisions` row. */
  held?: { decisionType: string; reason: string; payload: any };
  data?: any;
  error?: string;
}

export type SkillHandler = (input: any, ctx: SkillContext) => Promise<SkillResult>;

/**
 * Authoritative map of skill_id → handler.
 *
 * Skills not yet implemented map to a stub handler that returns a `held`
 * decision so REX can still surface the proposed action to a human.
 */
export const SKILL_HANDLERS: Record<string, SkillHandler> = {
  // SOURCER
  linkedin_sourcer:     sourcerHandlers.linkedinSourcer,
  apollo_enrich:        sourcerHandlers.apolloEnrich,
  icp_researcher:       sourcerHandlers.icpResearcher,
  browser_researcher:   sourcerHandlers.browserResearcher,
  hunter_skill:         sourcerHandlers.hunterSkill,
  skrapp_skill:         sourcerHandlers.skrappSkill,
  github_sourcer:       sourcerHandlers.githubSourcer,
  twitter_sourcer:      sourcerHandlers.twitterSourcer,

  // RECRUITER
  outreach_writer:      recruiterHandlers.outreachWriter,
  reply_handler:        recruiterHandlers.replyHandler,
  submittal_drafter:    recruiterHandlers.submittalDrafter,
  pipeline_manager:     recruiterHandlers.pipelineManager,

  // COORDINATOR
  calendar_sync_google:  coordinatorHandlers.calendarSyncGoogle,
  calendar_sync_outlook: coordinatorHandlers.calendarSyncOutlook,
  interview_booker:      coordinatorHandlers.interviewBooker,
  reminder_bot:          coordinatorHandlers.reminderBot,
  reschedule_mgr:        coordinatorHandlers.rescheduleMgr,

  // RESEARCHER
  company_intel:        researcherHandlers.companyIntel,
  comp_benchmark:       researcherHandlers.compBenchmark,
  news_watch:           researcherHandlers.newsWatch,

  // BUSINESS DEV
  hiring_signal_watch:  businessDevHandlers.hiringSignalWatch,
  cold_outreach_bd:     businessDevHandlers.coldOutreachBd,
  job_board_scrape:     businessDevHandlers.jobBoardScrape,

  // CLOSER
  offer_drafter:        closerHandlers.offerDrafter,
  negotiation_coach:    closerHandlers.negotiationCoach,
  counter_handler:      closerHandlers.counterHandler,

  // ACCOUNT MANAGER
  weekly_reports:       accountManagerHandlers.weeklyReports,
  pipeline_updater:     accountManagerHandlers.pipelineUpdater,
  renewal_nudge:        accountManagerHandlers.renewalNudge,

  // REFERENCE CHECKER
  reference_outreach:   referenceCheckerHandlers.referenceOutreach,
  back_channel:         referenceCheckerHandlers.backChannel,
  reference_synthesis:  referenceCheckerHandlers.referenceSynthesis,
};

/** Look up a skill by its catalog id. Returns null if no handler is registered. */
export function getSkillHandler(skillId: string): SkillHandler | null {
  return SKILL_HANDLERS[skillId] ?? null;
}

/** All skill ids registered in the runtime. */
export function listRegisteredSkills(): string[] {
  return Object.keys(SKILL_HANDLERS);
}
