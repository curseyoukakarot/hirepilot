console.log('### LOADED', __filename);
import express, { Request, Response } from 'express';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { enrichWithApollo } from '../services/apollo/enrichLead';
import { scrapeLinkedInProfile, BrightDataProfile } from '../services/brightdataClient';
import { analyzeProfile } from '../services/gpt/analyzeProfile';
import { requireAuth } from '../../middleware/authMiddleware';
import activeWorkspace from '../middleware/activeWorkspace';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { ApiRequest } from '../../types/api';
import { EmailEventService } from '../../services/emailEventService';
import { createZapEvent, EVENT_TYPES } from '../lib/events';
import { CreditService } from '../../services/creditService';
import { emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData } from '../../lib/zapEventEmitter';
import { applyWorkspaceScope, WORKSPACES_ENFORCE_STRICT } from '../lib/workspaceScope';
import axios from 'axios';
import decodoRouter from './leads/decodo/salesNavigatorScraper';
import enrichmentRouter from './leads/decodo/enrichLeadProfile';
import { fetchHtml } from '../lib/decodoProxy';
import { notifySlack } from '../../lib/slack';
import { getUserIntegrations } from '../../utils/userIntegrationsHelper';
import { isBrightDataEnabled } from '../config/brightdata';
import { enqueueLinkedInRemoteAction } from '../services/linkedinRemoteActions';
import { canUseRemoteLinkedInActions } from '../services/remoteActions';
import { hasLinkedInCookie } from '../services/linkedin/cookieService';
import { LinkedInRemoteActionType } from '../services/brightdataBrowser';
import { getSystemSettingBoolean } from '../utils/systemSettings';
import { getUserTeamContextDb } from '../lib/userTeamContext';
import { sendGtmStrategyAccessEmail } from '../lib/emails/gtmStrategyAccessEmail';

const router = express.Router();
router.use(requireAuth as any, activeWorkspace as any);

const scoped = (req: Request, table: string, ownerColumn: string = 'user_id') =>
  applyWorkspaceScope(supabase.from(table), {
    workspaceId: (req as any).workspaceId,
    userId: (req as any)?.user?.id,
    ownerColumn
  });

const scopedNoOwner = (req: Request, table: string) => {
  const base: any = supabase.from(table);
  const workspaceId = (req as any).workspaceId;
  if (!workspaceId) return base;
  const applyScope = (builder: any) => {
    if (!builder || typeof builder.eq !== 'function') return builder;
    if (WORKSPACES_ENFORCE_STRICT) return builder.eq('workspace_id', workspaceId);
    return builder.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  };
  if (typeof base.eq === 'function') return applyScope(base);
  const methodsToWrap = new Set(['select', 'update', 'delete', 'upsert']);
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target?.[prop];
      if (typeof value !== 'function') return value;
      const name = String(prop);
      if (!methodsToWrap.has(name)) return value.bind(target);
      return (...args: any[]) => applyScope(value.apply(target, args));
    }
  };
  return new Proxy(base, handler) as any;
};

function summarizeSupabaseError(error: any): string {
  if (!error) return 'Unknown Supabase error';
  if (typeof error === 'string') return error;
  const message = error?.message || error?.msg;
  const details = error?.details || error?.detail;
  const hint = error?.hint;
  const code = error?.code;
  const parts = [message, details, hint, code ? `code=${code}` : null].filter(Boolean);
  if (parts.length) return parts.join(' — ');
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unserializable Supabase error';
  }
}

function logAttachToCampaignError(
  phase: string,
  error: any,
  context: Record<string, any> = {}
) {
  console.error('[leads.attach-to-campaign]', {
    phase,
    context,
    supabase: {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code
    },
    stack: error?.stack,
    raw: error
  });
}

type LeadEntityType = 'lead' | 'candidate';

interface LeadResolutionResult {
  entityType: LeadEntityType;
  lead: any;
  targetId: string;
}

const PRIVILEGED_ROLES = ['admin', 'team_admin', 'team_admins', 'super_admin', 'SuperAdmin'] as const;

type TeamSharingSettings = {
  share_leads: boolean;
  share_candidates: boolean;
  allow_team_editing: boolean;
  team_admin_view_pool: boolean;
  share_analytics: boolean;
  analytics_admin_view_enabled: boolean;
  analytics_admin_view_user_id?: string | null;
  analytics_team_pool: boolean;
};

const DEFAULT_TEAM_SETTINGS: TeamSharingSettings = {
  share_leads: false,
  share_candidates: false,
  allow_team_editing: false,
  team_admin_view_pool: true,
  share_analytics: false,
  analytics_admin_view_enabled: false,
  analytics_admin_view_user_id: null,
  analytics_team_pool: false
};

async function fetchTeamSettingsForTeam(teamId?: string | null): Promise<TeamSharingSettings> {
  if (!teamId) return DEFAULT_TEAM_SETTINGS;
  const { data } = await supabase
    .from('team_settings')
    .select('share_leads, share_candidates, allow_team_editing, team_admin_view_pool, share_analytics, analytics_admin_view_enabled, analytics_admin_view_user_id, analytics_team_pool')
    .eq('team_id', teamId)
    .maybeSingle();
  return {
    share_leads: !!data?.share_leads,
    share_candidates: !!data?.share_candidates,
    allow_team_editing: !!data?.allow_team_editing,
    team_admin_view_pool:
      data?.team_admin_view_pool === undefined || data?.team_admin_view_pool === null
        ? true
        : !!data?.team_admin_view_pool,
    share_analytics: !!data?.share_analytics,
    analytics_admin_view_enabled: !!data?.analytics_admin_view_enabled,
    analytics_admin_view_user_id: data?.analytics_admin_view_user_id || null,
    analytics_team_pool: !!data?.analytics_team_pool
  };
}

async function resolveLeadSharingContext(viewerId: string, ownerId: string) {
  const [viewerCtx, ownerCtx] = await Promise.all([
    getUserTeamContextDb(viewerId),
    getUserTeamContextDb(ownerId),
  ]);

  const viewerTeamId = viewerCtx.teamId || null;
  const ownerTeamId = ownerCtx.teamId || null;
  const sameTeam = Boolean(viewerTeamId && ownerTeamId && String(viewerTeamId) === String(ownerTeamId));
  const teamSettings = sameTeam && ownerTeamId
    ? await fetchTeamSettingsForTeam(ownerTeamId)
    : DEFAULT_TEAM_SETTINGS;

  const role = String(viewerCtx.role || '').toLowerCase();
  const privileged = PRIVILEGED_ROLES.includes(role as any);

  const viewer = { id: viewerId, team_id: viewerTeamId, role: viewerCtx.role ?? null } as any;
  const owner = { id: ownerId, team_id: ownerTeamId } as any;
  return { viewer, owner, sameTeam, teamSettings, privileged };
}

async function resolveLeadOrCandidateEntity(
  leadId: string,
  userId: string,
  workspaceId?: string | null
): Promise<LeadResolutionResult | null> {
  let entityType: LeadEntityType = 'lead';
  let lead: any = null;
  let targetId: string = leadId;

  const { data: leadData } = await applyWorkspaceScope(
    supabase.from('leads').select('*'),
    { workspaceId, userId, ownerColumn: 'user_id' }
  )
    .eq('id', leadId)
    .eq('user_id', userId)
    .maybeSingle();
  lead = leadData;

  if (!lead) {
    const { data: candidate } = await applyWorkspaceScope(
      supabase.from('candidates').select('*'),
      { workspaceId, userId, ownerColumn: 'user_id' }
    )
      .eq('id', leadId)
      .maybeSingle();

    if (candidate) {
      entityType = 'candidate';
      lead = {
        id: candidate.id,
        user_id: candidate.user_id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
        email: candidate.email || null,
        phone: candidate.phone || null,
        title: candidate.title || null,
        company: candidate.company || null,
        linkedin_url: candidate.linkedin_url || null,
        enrichment_data: candidate.enrichment_data || {},
        enhanced_insights_unlocked: candidate.enhanced_insights_unlocked,
        enhanced_insights: candidate.enhanced_insights,
        has_enhanced_enrichment: candidate.has_enhanced_enrichment
      };
      targetId = candidate.id;
    } else {
      const { data: candidateByLead } = await applyWorkspaceScope(
        supabase.from('candidates').select('*'),
        { workspaceId, userId, ownerColumn: 'user_id' }
      )
        .eq('lead_id', leadId)
        .maybeSingle();

      if (candidateByLead) {
        entityType = 'candidate';
        lead = {
          id: candidateByLead.id,
          user_id: candidateByLead.user_id,
          first_name: candidateByLead.first_name,
          last_name: candidateByLead.last_name,
          name: `${candidateByLead.first_name || ''} ${candidateByLead.last_name || ''}`.trim(),
          email: candidateByLead.email || null,
          phone: candidateByLead.phone || null,
          title: candidateByLead.title || null,
          company: candidateByLead.company || null,
          linkedin_url: candidateByLead.linkedin_url || null,
          enrichment_data: candidateByLead.enrichment_data || {},
          enhanced_insights_unlocked: candidateByLead.enhanced_insights_unlocked,
          enhanced_insights: candidateByLead.enhanced_insights,
          has_enhanced_enrichment: candidateByLead.has_enhanced_enrichment
        };
        targetId = candidateByLead.id;
      } else {
        const { data: leadAny } = await applyWorkspaceScope(
          supabase.from('leads').select('*, user_id'),
          { workspaceId, userId, ownerColumn: 'user_id' }
        )
          .eq('id', leadId)
          .maybeSingle();

        if (leadAny) {
          const { data: me } = await supabase.from('users').select('id, team_id, role').eq('id', userId).maybeSingle();
          const { data: owner } = await supabase.from('users').select('id, team_id').eq('id', leadAny.user_id).maybeSingle();

          const sameTeam = (me as any)?.team_id && owner?.team_id && (me as any).team_id === owner.team_id;
          const privileged = PRIVILEGED_ROLES.includes((((me as any)?.role) || '') as any);

          if (sameTeam || privileged) {
            entityType = 'lead';
            lead = leadAny;
            targetId = leadAny.id;
          }
        }

        if (!lead) {
          const { data: candAny } = await applyWorkspaceScope(
            supabase.from('candidates').select('*'),
            { workspaceId, userId, ownerColumn: 'user_id' }
          )
            .or(`id.eq.${leadId},lead_id.eq.${leadId}`)
            .maybeSingle();

          if (candAny) {
            const { data: me } = await supabase.from('users').select('id, team_id, role').eq('id', userId).maybeSingle();
            const { data: owner } = await supabase.from('users').select('id, team_id').eq('id', candAny.user_id).maybeSingle();
            const sameTeam = (me as any)?.team_id && owner?.team_id && (me as any).team_id === owner.team_id;
            const privileged = PRIVILEGED_ROLES.includes((((me as any)?.role) || '') as any);
            if (sameTeam || privileged || candAny.user_id === userId) {
              entityType = 'candidate';
              lead = {
                id: candAny.id,
                user_id: candAny.user_id,
                first_name: candAny.first_name,
                last_name: candAny.last_name,
                name: `${candAny.first_name || ''} ${candAny.last_name || ''}`.trim(),
                email: candAny.email || null,
                phone: candAny.phone || null,
                title: candAny.title || null,
                company: candAny.company || null,
                linkedin_url: candAny.linkedin_url || null,
                enrichment_data: candAny.enrichment_data || {},
                enhanced_insights_unlocked: candAny.enhanced_insights_unlocked,
                enhanced_insights: candAny.enhanced_insights,
                has_enhanced_enrichment: candAny.has_enhanced_enrichment
              };
              targetId = candAny.id;
            }
          }
        }
      }
    }
  }

  if (!lead) {
    return null;
  }

  return { entityType, lead, targetId };
}

function buildEnrichmentStatus(entity: any, overrides?: { source?: string; success?: boolean; errors?: string[] }) {
  const lastAttempt = entity?.enrichment_data?.last_enrichment_attempt || {};
  const source = overrides?.source ?? lastAttempt?.source ?? 'none';
  const errors = Array.isArray(overrides?.errors)
    ? overrides?.errors
    : Array.isArray(lastAttempt?.errors)
      ? lastAttempt.errors
      : [];
  const success = typeof overrides?.success === 'boolean'
    ? overrides.success
    : Boolean(source && source !== 'none');
  return {
    source,
    success,
    errors
  };
}

function inferEnhancedProvider(entity: any): 'apollo' | 'skrapp' | null {
  const explicit = entity?.enhanced_insights?.provider;
  if (explicit === 'apollo' || explicit === 'skrapp') return explicit;
  const fromLastAttempt = entity?.enrichment_data?.last_enrichment_attempt?.source;
  if (fromLastAttempt === 'apollo' || fromLastAttempt === 'skrapp') return fromLastAttempt;
  if (entity?.enrichment_data?.apollo) return 'apollo';
  if (entity?.enrichment_data?.skrapp) return 'skrapp';
  return null;
}

function buildEnhancedInsightsStatus(entity: any) {
  return {
    unlocked: Boolean(entity?.enhanced_insights_unlocked ?? entity?.has_enhanced_enrichment),
    provider: inferEnhancedProvider(entity)
  };
}

function buildEnhancedInsightsSnapshot(provider: 'apollo' | 'skrapp', lead: any) {
  const enrichmentData = lead?.enrichment_data || {};
  const apollo = enrichmentData.apollo || {};
  const skrapp = enrichmentData.skrapp || {};
  const sourceData = provider === 'apollo' ? apollo : skrapp;
  const organization = provider === 'apollo'
    ? (apollo.organization || {})
    : {};
  const companyInfo = provider === 'skrapp'
    ? sourceData
    : {};

  const company = provider === 'apollo'
    ? {
        name: organization?.name || lead?.company || null,
        domain: organization?.domain || organization?.website_url || null,
        revenue_range: organization?.estimated_annual_revenue || organization?.annual_revenue || null,
        employee_count: organization?.employee_count || organization?.estimated_num_employees || null,
        employee_range: organization?.employee_count_range || organization?.estimated_num_employees || null,
        industry: organization?.industry || organization?.naics_description || null,
        headquarters: organization?.location || organization?.headquarters || null,
        funding_total: organization?.total_funding || organization?.funding_total || null,
        last_funding_round: organization?.last_funding_type || null,
        last_funding_amount: organization?.last_funding_amount || null,
        technologies: apollo?.technologies || organization?.technologies || null,
        keywords: apollo?.keywords || organization?.keywords || null
      }
    : {
        name: companyInfo?.company_name || companyInfo?.name || lead?.company || null,
        domain: companyInfo?.company_domain || companyInfo?.domain || companyInfo?.website || null,
        revenue_range: companyInfo?.company_revenue_range || companyInfo?.revenue_range || null,
        employee_count: companyInfo?.company_employee_count || null,
        employee_range: companyInfo?.company_employee_range || companyInfo?.company_size || null,
        industry: companyInfo?.company_industry || companyInfo?.industry || null,
        headquarters: companyInfo?.company_headquarters || companyInfo?.headquarters || null,
        funding_total: companyInfo?.company_funding || companyInfo?.funding_total || null,
        last_funding_round: companyInfo?.last_funding_round || null,
        last_funding_amount: companyInfo?.last_funding_amount || null,
        technologies: companyInfo?.technologies || null,
        keywords: companyInfo?.keywords || null
      };

  return {
    provider,
    company,
    unlocked_at: new Date().toISOString()
  };
}

function deriveDomainFromRecord(entity: any, fallbackCompany?: string): string {
  if (!entity) return '';
  const fromApollo = entity?.enrichment_data?.apollo?.organization;
  const apolloDomain = String(fromApollo?.domain || fromApollo?.website_url || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (apolloDomain) return apolloDomain.toLowerCase();

  const decodoSite = String(entity?.enrichment_data?.decodo?.company_website || entity?.enrichment_data?.decodo?.website || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (decodoSite) return decodoSite.toLowerCase();

  const brightdataSite = String(entity?.enrichment_data?.brightdata?.company_url || entity?.brightdata_raw?.company_url || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (brightdataSite) return brightdataSite.toLowerCase();

  const fallback = String(fallbackCompany || entity?.company || '').trim();
  if (fallback.includes('.')) {
    return fallback.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  if (fallback) {
    return `${fallback.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`;
  }

  return '';
}

interface BrightDataPipelineOptions {
  lead: any;
  entityType: LeadEntityType;
  targetId: string;
  userId: string;
  leadId: string;
}

interface BrightDataPipelineResponse {
  status: number;
  body: any;
}

function extractBrightDataKeywords(profile: BrightDataProfile): string[] {
  const keywordSet = new Set<string>();

  const addTokens = (text?: string | null, limit = 25) => {
    if (!text || typeof text !== 'string') return;
    const matches = text.toLowerCase().match(/[a-z0-9]+/g);
    if (!matches) return;
    let added = 0;
    for (const token of matches) {
      if (token.length <= 2) continue;
      keywordSet.add(token);
      added++;
      if (limit > 0 && added >= limit) break;
    }
  };

  addTokens(profile.headline, 15);
  addTokens(profile.current_title, 15);
  addTokens(profile.current_company, 10);
  addTokens(profile.location, 10);

  if (Array.isArray(profile.skills)) {
    profile.skills.forEach(skill => {
      if (typeof skill === 'string') {
        addTokens(skill, 8);
      } else if (skill && typeof skill === 'object') {
        addTokens((skill as any).name, 8);
      }
    });
  }

  addTokens(profile.about, 40);

  if (Array.isArray(profile.experience)) {
    profile.experience.forEach(exp => {
      addTokens(exp?.title, 12);
      addTokens(exp?.company, 12);
      addTokens(exp?.description, 25);
    });
  }

  return Array.from(keywordSet);
}

function normalizeKeywordToken(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length < 2) return null;
  return normalized;
}

function coerceKeywordArray(value: unknown): string[] {
  if (!value) return [];
  let raw: string[] = [];
  if (Array.isArray(value)) {
    raw = value.filter((kw): kw is string => typeof kw === 'string');
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        raw = parsed.filter((kw): kw is string => typeof kw === 'string');
      } else {
        raw = value.split(',').map(segment => segment.trim());
      }
    } catch {
      raw = value.split(',').map(segment => segment.trim());
    }
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  raw.forEach(item => {
    const token = normalizeKeywordToken(item);
    if (token && !seen.has(token)) {
      seen.add(token);
      normalized.push(token);
    }
  });
  return normalized;
}

function mergeKeywordLists(existing: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  const addValue = (value: string) => {
    const token = normalizeKeywordToken(value);
    if (token && !seen.has(token)) {
      seen.add(token);
      merged.push(token);
    }
  };

  existing.forEach(addValue);
  additions.forEach(addValue);
  return merged;
}

interface EmailEnrichmentOptions {
  lead: any;
  brightProfile?: BrightDataProfile | null;
  userId: string;
  leadId: string;
  // If provided, avoids extra DB lookup per call.
  skrappApolloFallbackEnabled?: boolean;
}

interface EmailEnrichmentResult {
  email: string | null;
  emailStatus: 'pending' | 'found' | 'not_found' | null;
  emailSource: 'apollo' | 'skrapp' | null;
  enrichmentDataPatch?: Record<string, unknown>;
  errors: string[];
  creditDescription?: string;
}

async function runBrightDataEnrichmentFlow(options: BrightDataPipelineOptions): Promise<BrightDataPipelineResponse> {
  const { lead, entityType, targetId, userId, leadId } = options;
  const tableName = entityType === 'lead' ? 'leads' : 'candidates';
  const now = new Date().toISOString();
  const errorMessages: string[] = [];

  await supabase
    .from(tableName)
    .update({
      enrichment_status: 'pending',
      enrichment_source: 'brightdata',
      enrichment_error: null,
      email_status: 'pending',
      email_source: null,
      updated_at: now
    })
    .eq('id', targetId);

  let brightProfile: BrightDataProfile | null = null;
  if (lead.linkedin_url) {
    console.log('[LeadEnrich] [BrightData] Starting profile scrape', { leadId, url: lead.linkedin_url });
    brightProfile = await scrapeLinkedInProfile(lead.linkedin_url);
    if (!brightProfile) {
      errorMessages.push('Bright Data returned no profile data');
    }
  } else {
    errorMessages.push('LinkedIn URL missing for Bright Data enrichment');
  }

  const brightDataKeywords = brightProfile ? extractBrightDataKeywords(brightProfile) : [];

  // Map BrightData profile into an Apollo-like shape so the frontend
  // (which expects enrichment_data.apollo) can render work history, title,
  // company, and name fields without change.
  const brightdataApolloPatch = (() => {
    if (!brightProfile) return null;

    const companyName = typeof brightProfile.current_company === 'object'
      ? (brightProfile.current_company as any)?.name
      : typeof brightProfile.current_company === 'string'
        ? brightProfile.current_company
        : null;

    const employment_history = Array.isArray(brightProfile.experience)
      ? brightProfile.experience.map((exp: any) => ({
          organization_name: exp?.company || exp?.company_name || companyName || null,
          company: exp?.company || exp?.company_name || companyName || null,
          title: exp?.title || exp?.position || brightProfile.current_title || brightProfile.headline || null,
          start_date: exp?.start_date || exp?.startDate || exp?.start || null,
          end_date: exp?.end_date || exp?.endDate || exp?.end || null,
          current: exp?.end_date ? false : exp?.current ?? null,
          description: exp?.description || exp?.summary || null,
          location: exp?.location || exp?.city || brightProfile.location || null
        }))
      : undefined;

    const organization = companyName
      ? {
          name: companyName,
          domain: null,
          location: (brightProfile.current_company as any)?.location || brightProfile.location || null
        }
      : undefined;

    const locationObj = brightProfile.location
      ? { city: brightProfile.location, state: null, country: null }
      : undefined;

    return {
      first_name: brightProfile.first_name || brightProfile.full_name || null,
      last_name: brightProfile.last_name || null,
      title: brightProfile.current_title || brightProfile.headline || null,
      headline: brightProfile.headline || null,
      linkedin_url: brightProfile.profile_url || null,
      organization,
      employment_history,
      location: locationObj,
      enriched_at: new Date().toISOString(),
      source: 'brightdata'
    };
  })();

  const emailResult = await runEmailEnrichment({
    lead,
    brightProfile,
    userId,
    leadId
  });

  const enrichmentData = {
    ...(lead.enrichment_data || {}),
    ...(brightdataApolloPatch
      ? {
          apollo: {
            ...(lead.enrichment_data?.apollo || {}),
            ...brightdataApolloPatch
          }
        }
      : {}),
    ...(brightProfile
      ? {
          brightdata: {
            ...brightProfile,
            fetched_at: now
          }
        }
      : {}),
    ...(emailResult.enrichmentDataPatch || {}),
    last_enrichment_attempt: {
      attempted_at: now,
      source: brightProfile ? 'brightdata' : emailResult.emailSource || 'none',
      errors: [...errorMessages, ...emailResult.errors]
    }
  };

  const updatePayload: Record<string, unknown> = {
    enrichment_data: enrichmentData,
    enrichment_status: brightProfile ? 'succeeded' : 'failed',
    enrichment_source: brightProfile ? 'brightdata' : null,
    enrichment_error: brightProfile ? null : errorMessages[0] || null,
    email_status: emailResult.emailStatus,
    email_source: emailResult.emailSource,
    brightdata_raw: brightProfile?._raw || brightProfile || null,
    updated_at: now
  };

  const companyName = typeof brightProfile?.current_company === 'object'
    ? (brightProfile?.current_company as any)?.name
    : typeof brightProfile?.current_company === 'string'
      ? brightProfile?.current_company
      : null;

  if (brightProfile?.current_title) updatePayload.title = brightProfile.current_title;
  if (companyName) updatePayload.company = companyName;
  if (brightProfile?.location && entityType === 'lead') updatePayload.location = brightProfile.location;
  if (brightProfile?.profile_url && entityType === 'lead') updatePayload.linkedin_url = brightProfile.profile_url;
  if (brightProfile?.first_name && entityType === 'lead') updatePayload.first_name = brightProfile.first_name;
  if (brightProfile?.last_name && entityType === 'lead') updatePayload.last_name = brightProfile.last_name;
  if (emailResult.email) updatePayload.email = emailResult.email;

  // Skip enrichment_keywords when the column is not present in some deployments

  const { data: updatedRecord, error: updateError } = await supabase
    .from(tableName)
    .update(updatePayload)
    .eq('id', targetId)
    .select('*')
    .maybeSingle();

  if (updateError || !updatedRecord) {
    console.error('[LeadEnrich] [BrightData] Failed to update record', updateError);
    return {
      status: 500,
      body: {
        success: false,
        message: 'Failed to save enrichment data'
      }
    };
  }

  if (brightProfile) {
    try {
      await CreditService.deductCredits(
        userId,
        1,
        'api_usage',
        `BrightData profile enrichment: ${(brightProfile.full_name || lead.name || '').trim() || targetId}`
      );
    } catch (creditErr) {
      console.error('[LeadEnrich] BrightData credit deduction failed (non-fatal):', creditErr);
    }
  }

  if (emailResult.creditDescription) {
    try {
      await CreditService.deductCredits(userId, 1, 'api_usage', emailResult.creditDescription);
    } catch (creditErr) {
      console.error('[LeadEnrich] Email credit deduction failed (non-fatal):', creditErr);
    }
  }

  try {
    await createZapEvent({
      event_type: EVENT_TYPES.lead_enrich_requested,
      user_id: userId,
      entity: entityType === 'lead' ? 'lead' : 'candidate',
      entity_id: targetId,
      payload: { source: brightProfile ? 'brightdata' : emailResult.emailSource, errors: [...errorMessages, ...emailResult.errors] }
    });
  } catch {}

  return {
    status: 200,
    body: {
      ...updatedRecord,
      enrichment_status: buildEnrichmentStatus(updatedRecord, {
        source: brightProfile ? 'brightdata' : emailResult.emailSource || 'none',
        success: Boolean(brightProfile),
        errors: [...errorMessages, ...emailResult.errors]
      }),
      enhanced_insights_status: buildEnhancedInsightsStatus(updatedRecord)
    }
  };
}

function buildPreferredFullName(lead: any, brightProfile?: BrightDataProfile | null): string {
  const pieces = [
    lead?.first_name || brightProfile?.first_name,
    lead?.last_name || brightProfile?.last_name
  ].filter(Boolean);
  if (pieces.length) return pieces.join(' ').trim();
  return brightProfile?.full_name || lead?.name || '';
}

async function runEmailEnrichment(options: EmailEnrichmentOptions): Promise<EmailEnrichmentResult> {
  const { lead, brightProfile, userId, leadId } = options;
  const errors: string[] = [];
  const enrichmentDataPatch: Record<string, unknown> = {};
  let emailStatus: 'pending' | 'found' | 'not_found' | null = 'pending';
  let emailSource: 'apollo' | 'skrapp' | null = null;
  let creditDescription: string | undefined;
  let email: string | null = lead.email || null;

  if (email) {
    emailStatus = 'found';
    return { email, emailStatus, emailSource, enrichmentDataPatch, errors };
  }

  try {
    const apolloResult = await enrichWithApollo({
      leadId,
      userId,
      firstName: lead.first_name || brightProfile?.first_name,
      lastName: lead.last_name || brightProfile?.last_name,
      company: lead.company || brightProfile?.current_company,
      linkedinUrl: lead.linkedin_url || brightProfile?.profile_url
    });

    if (apolloResult?.success && apolloResult.data?.email && !apolloResult.data.email.includes('email_not_unlocked')) {
      email = apolloResult.data.email;
      emailStatus = 'found';
      emailSource = 'apollo';
      enrichmentDataPatch.apollo = {
        ...apolloResult.data,
        enriched_at: new Date().toISOString(),
        used_for_email: true
      };
      creditDescription = `Apollo email enrichment: ${buildPreferredFullName(lead, brightProfile) || leadId}`;
      return { email, emailStatus, emailSource, enrichmentDataPatch, errors, creditDescription };
    }

    if (apolloResult && !apolloResult.success) {
      errors.push('Apollo email not found');
    }
  } catch (error: any) {
    errors.push(`Apollo error: ${error?.message || 'Unknown error'}`);
  }

  if (!email) {
    try {
      const skrappApolloFallbackEnabled =
        typeof options.skrappApolloFallbackEnabled === 'boolean'
          ? options.skrappApolloFallbackEnabled
          : await getSystemSettingBoolean('skrapp_apollo_fallback_enabled', false);

      if (!skrappApolloFallbackEnabled) {
        // Skrapp disabled platform-wide unless explicitly enabled by Super Admin.
        // Do not treat as an error; just skip.
        return { email, emailStatus, emailSource, enrichmentDataPatch, errors };
      }

      const integrations = await getUserIntegrations(userId);
      // Only use Skrapp when the USER has explicitly provided their own key.
      const skrappApiKey = (integrations?.skrapp_api_key || '').trim();

      if (!skrappApiKey) {
        // User hasn't provided a Skrapp key; skip silently.
      } else {
        const fullName = buildPreferredFullName(lead, brightProfile);
        const domain = deriveDomainFromRecord(lead, brightProfile?.current_company);
        if (!fullName) {
          errors.push('Skrapp skipped: missing contact name');
        } else if (!domain) {
          errors.push('Skrapp skipped: missing company/domain');
        } else {
          const { enrichWithSkrapp } = await import('../../services/skrapp/enrichLead') as any;
          const skrappEmail = await enrichWithSkrapp(skrappApiKey, fullName, domain, brightProfile?.current_company || lead.company);
          if (skrappEmail) {
            email = skrappEmail;
            emailStatus = 'found';
            emailSource = 'skrapp';
            enrichmentDataPatch.skrapp = {
              ...(lead.enrichment_data?.skrapp || {}),
              email: skrappEmail,
              enriched_at: new Date().toISOString()
            };
            creditDescription = `Skrapp email enrichment: ${fullName || leadId}`;
            return { email, emailStatus, emailSource, enrichmentDataPatch, errors, creditDescription };
          }
          errors.push('Skrapp email not found');
        }
      }
    } catch (error: any) {
      errors.push(`Skrapp error: ${error?.message || 'Unknown error'}`);
    }
  }

  if (!email) {
    emailStatus = 'not_found';
  }

  return { email, emailStatus, emailSource, enrichmentDataPatch, errors };
}

// Debug logging for route registration
console.log('Registering leads routes...');

// Mount Decodo routes
router.use('/', decodoRouter);

// Add compatibility route for frontend that expects /api/leads/:id/enrich
router.post('/:id/enrich', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const leadId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: 'Lead ID is required'
      });
    }

    const resolved = await resolveLeadOrCandidateEntity(leadId, userId, (req as any).workspaceId);
    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or access denied'
      });
    }
    const { lead, entityType, targetId } = resolved;

    console.log(`[LeadEnrich] Starting enrichment for lead: ${lead.first_name} ${lead.last_name}`);

    // Require user to have at least 1 credit before running enrichment providers
    try {
      const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
      if (!hasCredits) {
        return res.status(402).json({ success: false, message: 'Insufficient credits for enrichment', required: 1 });
      }
    } catch (e) {
      // Non-fatal: if credit service is unavailable, allow attempt but still try to deduct on success
      console.warn('[LeadEnrich] Credit pre-check failed (continuing):', (e as any)?.message || e);
    }

    let enrichmentData: any = {};
    let enrichmentSource = 'none';
    let errorMessages: string[] = [];

    const userIntegrations = await getUserIntegrations(userId);
    const hunterApiKey = (userIntegrations.hunter_api_key || process.env.HUNTER_API_KEY || '').trim();
    const skrappApolloFallbackEnabled = await getSystemSettingBoolean('skrapp_apollo_fallback_enabled', false);
    // Only use Skrapp when the USER has explicitly provided their own key (no env fallbacks).
    const skrappApiKey = (userIntegrations.skrapp_api_key || '').trim();
    const premiumPreference: 'skrapp' | 'hunter' | 'apollo' = (userIntegrations.enrichment_source as 'skrapp' | 'apollo') || 'hunter';
    const hasHunterKey = hunterApiKey.length > 0;
    const hasSkrappKey = skrappApolloFallbackEnabled && skrappApiKey.length > 0;

    const deriveDomainFromLead = (entity: any): string => {
      if (!entity) return '';
      const apolloOrg = entity?.enrichment_data?.apollo?.organization || {};
      const fromApollo = String(apolloOrg.domain || apolloOrg.website_url || '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
      if (fromApollo) return fromApollo.toLowerCase();

      const decodoSite = String(entity?.enrichment_data?.decodo?.company_website || entity?.enrichment_data?.decodo?.website || '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
      if (decodoSite) return decodoSite.toLowerCase();

      const companyValue = String(entity?.company || entity?.enrichment_data?.apollo?.organization?.name || '').trim();
      if (!companyValue) return '';
      if (companyValue.includes('.')) {
        return companyValue
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0];
      }
      const normalized = companyValue
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
      return normalized ? `${normalized}.com` : '';
    };

    const deriveFullNameFromLead = (entity: any): string => {
      const fullName = `${entity?.first_name || ''} ${entity?.last_name || ''}`.trim();
      if (fullName) return fullName;
      const fromNameField = String(entity?.name || '').trim();
      if (fromNameField) return fromNameField;
      const fromDecodo = String(entity?.enrichment_data?.decodo?.full_name || entity?.enrichment_data?.decodo?.name || '').trim();
      if (fromDecodo) return fromDecodo;
      const fromApollo = String(entity?.enrichment_data?.apollo?.apollo_suggested_name || '').trim();
      if (fromApollo) return fromApollo;
      return '';
    };

    const enrichmentDomain = deriveDomainFromLead(lead);
    const enrichmentFullName = deriveFullNameFromLead(lead);
    const companyForSkrapp = lead?.company || lead?.enrichment_data?.apollo?.organization?.name || lead?.enrichment_data?.decodo?.company || undefined;

    // Enrichment order: Apollo first. Optional Skrapp fallback is controlled by system flag.
    const providerOrder: Array<'skrapp' | 'hunter'> = hasSkrappKey ? ['skrapp', 'hunter'] : ['hunter'];

    const needsPrimaryEmail = () =>
      !(
        enrichmentData.decodo?.email ||
        enrichmentData.hunter?.email ||
        enrichmentData.skrapp?.email
      );

    console.log('[LeadEnrich] Provider configuration (Apollo -> Skrapp -> Hunter):', {
      providerOrder,
      hasHunterKey,
      hasSkrappKey,
      skrappApolloFallbackEnabled,
      fullNameAvailable: !!enrichmentFullName,
      domainAvailable: !!enrichmentDomain
    });

    // STEP 1: Try Decodo first (with LinkedIn authentication)
    if (lead.linkedin_url) {
      try {
        console.log('[LeadEnrich] Step 1: Attempting Decodo enrichment...');
        
        // Import the enrichWithDecodo function from the enrichLeadProfile module
        const enrichLeadProfileModule = await import('./leads/decodo/enrichLeadProfile');
        
        // The function is not exported, so we'll call the Decodo logic directly
        const { decryptCookie } = await import('../utils/encryption');
        
        // Get LinkedIn cookie for authenticated scraping
        const { data: cookieData } = await supabase
          .from('linkedin_cookies')
          .select('encrypted_cookie, valid, updated_at')
          .eq('user_id', userId)
          .single();

        // Enforce freshness (24h) and validity
        const cookieFresh = cookieData && cookieData.updated_at && new Date(cookieData.updated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (!cookieData || !cookieData.valid || !cookieFresh) {
          const { ErrorWithCode } = await import('../utils/errors');
          throw new ErrorWithCode('Missing or stale LinkedIn cookie', 402);
        }

        let linkedinCookie = null;
        if (cookieData?.encrypted_cookie) {
          try {
            linkedinCookie = decryptCookie(cookieData.encrypted_cookie);
            await supabase
              .from('linkedin_cookies')
              .update({ last_used_at: new Date().toISOString() })
              .eq('user_id', userId);
          } catch (error) {
            console.warn('[LeadEnrich] Failed to decrypt LinkedIn cookie:', error);
          }
        }

        const { html, size } = await fetchHtml(lead.linkedin_url, linkedinCookie ? `li_at=${linkedinCookie}` : '');

        // Log bandwidth usage for auditing
        await supabase
          .from('decodo_bandwidth_log')
          .insert({ user_id: userId, type: 'profile', bytes: size, created_at: new Date().toISOString() });

        if (html && !html.includes('Sign in to LinkedIn')) {
          // Parse the LinkedIn profile data using Cheerio
          const { parseLinkedInProfile } = await import('../utils/cheerio/salesNavParser');
          const profileData = parseLinkedInProfile(html);

          if (profileData.headline || profileData.summary || profileData.experience?.length || profileData.email) {
            enrichmentData.decodo = {
              ...profileData,
              enriched_at: new Date().toISOString()
            };
            enrichmentSource = 'decodo';
            console.log('[LeadEnrich] ✅ Decodo enrichment successful');
          }
        } else {
          console.log('[LeadEnrich] ❌ Decodo failed: LinkedIn authentication required');
          errorMessages.push('Decodo: LinkedIn authentication required');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Decodo enrichment failed:', error.message);
        errorMessages.push(`Decodo: ${error.message}`);
      }
    }

    // STEP 2 & 3: Run providers in order: Apollo (profile + email), then Skrapp, then Hunter
    const tryHunterEmail = async () => {
      if (!needsPrimaryEmail()) {
        return;
      }
      if (!hasHunterKey) {
        console.log('[LeadEnrich] Hunter.io enrichment skipped: no API key configured');
        errorMessages.push('Hunter: Missing API key');
        return;
      }
      if (!enrichmentFullName || !enrichmentDomain) {
        console.log('[LeadEnrich] Hunter.io enrichment skipped due to missing full name or domain', {
          hasFullName: !!enrichmentFullName,
          hasDomain: !!enrichmentDomain
        });
        errorMessages.push('Hunter: Missing name or domain');
        return;
      }

      try {
        console.log('[LeadEnrich] Trying Hunter.io email enrichment...');
        const { enrichWithHunter } = await import('../../services/hunter/enrichLead');
        const hunterResult = await enrichWithHunter(hunterApiKey, enrichmentFullName, enrichmentDomain);
        
        if (hunterResult) {
          enrichmentData.hunter = {
            email: hunterResult,
            enriched_at: new Date().toISOString()
          };
          if (enrichmentSource === 'none') enrichmentSource = 'hunter';
          console.log('[LeadEnrich] ✅ Hunter.io enrichment successful');
        } else {
          console.log('[LeadEnrich] ❌ Hunter.io: No email found');
          errorMessages.push('Hunter: No email found');
        }
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Hunter enrichment failed:', error.message);
        errorMessages.push(`Hunter: ${error.message}`);
      }
    };

    const deriveNamePartsForSkrapp = (entity: any) => {
      const first = (entity?.first_name || '').trim();
      const last = (entity?.last_name || '').trim();
      if (first && last) return { firstName: first, lastName: last };
      const full = deriveFullNameFromLead(entity);
      if (!full) {
        return { firstName: first, lastName: last };
      }
      const parts = full.split(/\s+/).filter(Boolean);
      if (!first && parts[0]) {
        const resolvedFirst = parts[0];
        const resolvedLast = parts.slice(1).join(' ');
        return { firstName: resolvedFirst, lastName: last || resolvedLast };
      }
      if (!last && parts.length > 1) {
        return { firstName: first || parts[0], lastName: parts.slice(1).join(' ') };
      }
      return { firstName: first, lastName: last };
    };

    const hasSkrappPayload = (payload: Record<string, any> | undefined) => {
      if (!payload) return false;
      return Object.entries(payload).some(([key, value]) => {
        if (value === undefined || value === null) return false;
        if (['enriched_at', 'last_sync_reason', 'skrappStatus'].includes(key)) return false;
        if (key === 'raw_person' || key === 'raw_company') return Boolean(value);
        return true;
      });
    };

    const trySkrappEmail = async () => {
      if (!skrappApolloFallbackEnabled) {
        console.log('[LeadEnrich] Skrapp.io enrichment skipped: disabled by system setting');
        return;
      }
      if (!hasSkrappKey) {
        console.log('[LeadEnrich] Skrapp.io enrichment skipped: no API key configured');
        errorMessages.push('Skrapp: Missing API key');
        return;
      }
      if (!needsPrimaryEmail()) {
        return;
      }

      try {
        const { enrichWithSkrapp } = await import('../../services/skrapp/enrichLead');
        const fullNameForFinder = enrichmentFullName || deriveFullNameFromLead(lead);
        if (!fullNameForFinder) {
          console.log('[LeadEnrich] Skrapp email skipped: missing full name');
          errorMessages.push('Skrapp: Missing name for lookup');
          return;
        }

        const skrappEmail = await enrichWithSkrapp(
          skrappApiKey,
          fullNameForFinder,
          enrichmentDomain || '',
          companyForSkrapp
        );

        if (!skrappEmail) {
          console.log('[LeadEnrich] ❌ Skrapp.io: No email found');
          errorMessages.push('Skrapp: No email found');
          return;
        }

        enrichmentData.skrapp = {
          ...(enrichmentData.skrapp || {}),
          email: skrappEmail,
          enriched_at: new Date().toISOString()
        };
        if (enrichmentSource === 'none') enrichmentSource = 'skrapp';
        console.log('[LeadEnrich] ✅ Skrapp.io email enrichment successful');
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Skrapp email enrichment failed:', error.message);
        errorMessages.push(`Skrapp email: ${error.message}`);
      }
    };

    const mergeSkrappProfile = async (reason: 'premium' | 'apollo') => {
      if (!skrappApolloFallbackEnabled) return;
      if (!hasSkrappKey) return;
      try {
        const { enrichLeadWithSkrappProfileAndCompany } = await import('../../services/skrapp/enrichLead');
        const { firstName: skrappFirst, lastName: skrappLast } = deriveNamePartsForSkrapp(lead);
        const skrappProfile = await enrichLeadWithSkrappProfileAndCompany({
          apiKey: skrappApiKey,
          firstName: skrappFirst,
          lastName: skrappLast,
          fullName: enrichmentFullName || lead.name,
          domain: enrichmentDomain,
          company: companyForSkrapp
        });

        if (!skrappProfile) {
          return;
        }

        const { skrappStatus, ...skrappPayload } = skrappProfile;
        if (skrappStatus === 'no_data' || !hasSkrappPayload(skrappPayload)) {
          if (!errorMessages.includes('Skrapp: No data found')) {
            errorMessages.push('Skrapp: No data found');
          }
          return;
        }

        enrichmentData.skrapp = {
          ...(lead.enrichment_data?.skrapp || {}),
          ...(enrichmentData.skrapp || {}),
          ...skrappPayload,
          enriched_at: new Date().toISOString(),
          last_sync_reason: reason
        };
        if (enrichmentSource === 'none') {
          enrichmentSource = 'skrapp';
        }
        console.log('[LeadEnrich] ✅ Skrapp profile enrichment merged', { reason });
      } catch (error: any) {
        console.warn('[LeadEnrich] ❌ Skrapp profile enrichment failed:', error.message);
        errorMessages.push(`Skrapp profile: ${error.message}`);
      }
    };

    // STEP 2: Apollo first (profile + possible email)
    let apolloUsed = false;
    let apolloSucceeded = false;
    try {
      apolloUsed = true;
      console.log('[LeadEnrich] Step 2: Running Apollo enrichment first...');
      const apolloResult = await enrichWithApollo({
        leadId: leadId,
        userId: userId,
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company,
        linkedinUrl: lead.linkedin_url
      });

      if (apolloResult && apolloResult.success && apolloResult.data) {
        apolloSucceeded = true;
        enrichmentData.apollo = {
          ...apolloResult.data,
          used_as_fallback: false,
          enriched_at: new Date().toISOString()
        };
        if (enrichmentSource === 'none') enrichmentSource = 'apollo';
        console.log('[LeadEnrich] ✅ Apollo enrichment successful (primary)');
      } else {
        console.log('[LeadEnrich] ❌ Apollo: No data found');
        errorMessages.push('Apollo: No data found');
      }
    } catch (error: any) {
      console.warn('[LeadEnrich] ❌ Apollo enrichment failed:', error.message);
      errorMessages.push(`Apollo: ${error.message}`);
    }

    // STEP 3: Skrapp if still no email
    if (!enrichmentData.decodo?.email && !enrichmentData.apollo?.email) {
      await trySkrappEmail();
      if (hasSkrappKey && !hasSkrappPayload(enrichmentData.skrapp)) {
        await mergeSkrappProfile('apollo');
      }
    }

    // STEP 4: Hunter if still no email
    if (!enrichmentData.decodo?.email && !enrichmentData.apollo?.email && !enrichmentData.skrapp?.email) {
      await tryHunterEmail();
    }

    // Update lead with enrichment data
    const resolvedEnrichmentSource =
      hasSkrappPayload(enrichmentData.skrapp) ? 'skrapp' : enrichmentSource;

    const updateData: any = {
      enrichment_data: {
        ...(lead.enrichment_data || {}),
        ...enrichmentData,
        last_enrichment_attempt: {
          attempted_at: new Date().toISOString(),
          source: resolvedEnrichmentSource,
          errors: errorMessages
        }
      },
      updated_at: new Date().toISOString()
    };

    // Extract primary email to lead.email field (priority: Decodo > Hunter > Skrapp > Apollo)
    const primaryEmail = enrichmentData.decodo?.email || 
                        enrichmentData.hunter?.email || 
                        enrichmentData.skrapp?.email || 
                        enrichmentData.apollo?.email;
    
    if (primaryEmail && !primaryEmail.includes('email_not_unlocked')) {
      updateData.email = primaryEmail;
    }

    // Extract primary phone if available
    const primaryPhone = enrichmentData.apollo?.phone || enrichmentData.decodo?.phone;
    if (primaryPhone) {
      updateData.phone = primaryPhone;
    }

    // Extract title/headline if available  
    const headline = enrichmentData.decodo?.headline || 
                    enrichmentData.apollo?.title || 
                    enrichmentData.apollo?.headline;
    if (headline) {
      updateData.title = headline;
    }

    let updatedLead: any = null;
    if (entityType === 'lead') {
      const { data, error: updateError } = await applyWorkspaceScope(
        supabase.from('leads').update(updateData),
        { workspaceId: (req as any).workspaceId, userId, ownerColumn: 'user_id' }
      )
        .eq('id', targetId)
        .select()
        .maybeSingle();
      if (updateError) {
        console.error('[LeadEnrich] Failed to update lead:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save enrichment data'
        });
      }
      updatedLead = data;
    } else {
      // Update candidate record when enrichment performed from candidate view
      const candidateUpdate: any = {
        enrichment_data: updateData.enrichment_data,
        updated_at: new Date().toISOString()
      };
      if (updateData.email !== undefined) candidateUpdate.email = updateData.email;
      if (updateData.phone !== undefined) candidateUpdate.phone = updateData.phone;
      if (updateData.title !== undefined) candidateUpdate.title = updateData.title;

      const { data, error: updateError } = await applyWorkspaceScope(
        supabase.from('candidates').update(candidateUpdate),
        { workspaceId: (req as any).workspaceId, userId, ownerColumn: 'user_id' }
      )
        .eq('id', targetId)
        .select('*')
        .maybeSingle();
      if (updateError) {
        console.error('[LeadEnrich] Failed to update candidate:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save enrichment data'
        });
      }
      updatedLead = data;
    }

    console.log(`[LeadEnrich] Enrichment completed. Source: ${resolvedEnrichmentSource}`);

    // Deduct 1 credit only if we obtained any enrichment (source != none)
    if (resolvedEnrichmentSource !== 'none') {
      try {
        await CreditService.deductCredits(
          userId as string,
          1,
          'api_usage',
          `Profile enrichment: ${lead.first_name || ''} ${lead.last_name || ''}`.trim()
        );
      } catch (creditErr) {
        console.error('[LeadEnrich] Credit deduction failed (non-fatal):', creditErr);
      }
    }

    // Emit automation event: lead_enrich_requested
    try {
      await createZapEvent({
        event_type: EVENT_TYPES.lead_enrich_requested,
        user_id: userId!,
        entity: 'lead',
        entity_id: targetId,
        payload: { source: resolvedEnrichmentSource, errors: errorMessages }
      });
    } catch {}

    // Return updated lead with enrichment status
    return res.status(200).json({
      ...updatedLead,
      enrichment_status: buildEnrichmentStatus(updatedLead, {
        source: enrichmentSource,
        success: enrichmentSource !== 'none',
        errors: errorMessages
      }),
      enhanced_insights_status: buildEnhancedInsightsStatus(updatedLead)
    });

  } catch (error: any) {
    console.error('[LeadEnrich] Error in compatibility endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during enrichment',
      error: error.message
    });
  }
});

// POST /api/leads/:id/unlock-enhanced - Deduct 1 credit and unlock enhanced enrichment for this lead
router.post('/:id/unlock-enhanced', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const leadId = req.params.id;
    const userId = (req as any).user?.id as string;

    if (!leadId || !userId) {
      res.status(400).json({ error: 'Missing leadId or userId' });
      return;
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await scoped(req, 'leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // If already unlocked, return early
    if ((lead as any).has_enhanced_enrichment === true || (lead as any).enhanced_insights_unlocked === true) {
      res.json({ lead });
      return;
    }

    // Check credits (1 credit for enhanced enrichment toggle)
    const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
    if (!hasCredits) {
      res.status(402).json({ error: 'Insufficient credits', requiredCredits: 1 });
      return;
    }

    // Deduct 1 credit (logs usage appropriately)
    await CreditService.deductCredits(userId, 1, 'api_usage', 'Enhanced enrichment toggle');

    // Update lead flag
    const { data: updatedLead, error: updErr } = await scoped(req, 'leads')
      .update({
        has_enhanced_enrichment: true,
        enhanced_insights_unlocked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select('*')
      .maybeSingle();

    if (updErr || !updatedLead) {
      res.status(500).json({ error: 'Failed to update lead flag' });
      return;
    }

    // Emit event for analytics/automation
    try {
      await emitZapEvent({
        userId,
        eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
        eventData: createLeadEventData(updatedLead, {
          event_type: 'enhanced_enrichment_unlocked',
          metadata: { leadId, orgId: updatedLead.enrichment_data?.apollo?.organization?.id || null, userId }
        }),
        sourceTable: 'leads',
        sourceId: leadId
      });
    } catch {}

    res.json({ lead: updatedLead });
  } catch (error: any) {
    console.error('[unlock-enhanced] error', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// POST /api/leads/:id/enhanced-insights - unlock enhanced insights with normalized snapshot
router.post('/:id/enhanced-insights', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const leadId = req.params.id;
    const userId = (req as any).user?.id as string;

    if (!leadId || !userId) {
      res.status(400).json({ success: false, message: 'Missing leadId or userId' });
      return;
    }

    const resolved = await resolveLeadOrCandidateEntity(leadId, userId, (req as any).workspaceId);
    if (!resolved) {
      res.status(404).json({ success: false, message: 'Lead not found or access denied' });
      return;
    }
    const { lead, entityType, targetId } = resolved;

    const alreadyUnlocked = Boolean(lead?.enhanced_insights_unlocked ?? lead?.has_enhanced_enrichment);
    if (alreadyUnlocked) {
      res.json({
        ...lead,
        enrichment_status: buildEnrichmentStatus(lead),
        enhanced_insights_status: buildEnhancedInsightsStatus(lead)
      });
      return;
    }

    const apolloData = lead?.enrichment_data?.apollo;
    const skrappData = lead?.enrichment_data?.skrapp;

    if (!apolloData && !skrappData) {
      res.status(400).json({
        success: false,
        message: 'Base enrichment required before unlocking enhanced insights.'
      });
      return;
    }

    const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
    if (!hasCredits) {
      res.status(402).json({ success: false, message: 'Insufficient credits', required: 1 });
      return;
    }

    const chosenProvider: 'apollo' | 'skrapp' = apolloData ? 'apollo' : 'skrapp';
    const enhancedInsights = buildEnhancedInsightsSnapshot(chosenProvider, lead);

    const updatePayload: any = {
      enhanced_insights_unlocked: true,
      has_enhanced_enrichment: true,
      enhanced_insights: enhancedInsights,
      updated_at: new Date().toISOString()
    };

    const tableName = entityType === 'lead' ? 'leads' : 'candidates';
    const { data: updatedEntity, error: updateError } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq('id', targetId)
      .select('*')
      .maybeSingle();

    if (updateError || !updatedEntity) {
      console.error('[enhanced-insights] Failed to update entity:', updateError?.message);
      res.status(500).json({ success: false, message: 'Failed to unlock enhanced insights' });
      return;
    }

    try {
      await CreditService.deductCredits(
        userId,
        1,
        'api_usage',
        'Unlock enhanced company insights'
      );
    } catch (creditErr) {
      console.error('[enhanced-insights] Credit deduction failed (non-fatal):', creditErr);
    }

    try {
      await createZapEvent({
        event_type: EVENT_TYPES.enhanced_insights_unlocked,
        user_id: userId,
        entity: entityType,
        entity_id: targetId,
        payload: { provider: chosenProvider }
      });
    } catch (zapErr) {
      console.warn('[enhanced-insights] Failed to emit zap event:', zapErr);
    }

    res.status(200).json({
      ...updatedEntity,
      enrichment_status: buildEnrichmentStatus(updatedEntity),
      enhanced_insights_status: buildEnhancedInsightsStatus(updatedEntity)
    });
  } catch (error: any) {
    console.error('[enhanced-insights] Unexpected error', error);
    res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

// POST /api/leads/candidates/bulk-status - update multiple candidates' status (owner only)
router.post('/candidates/bulk-status', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids, status } = req.body || {};
    console.log('[POST /api/leads/candidates/bulk-status]', { idsCount: Array.isArray(ids) ? ids.length : 0, status });
    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'Missing ids' }); return; }
    if (!ALLOWED_STATUS.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }

    const { error } = await scoped(req, 'candidates')
      .update({ status })
      .in('id', ids)
      .eq('user_id', userId);
    if (error) { res.status(500).json({ error: 'Failed to update status' }); return; }
    res.json({ success: true });
  } catch (e) {
    console.error('Bulk status (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/leads/candidates/bulk-delete - delete multiple candidates (owner only)
router.post('/candidates/bulk-delete', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { ids } = req.body || {};
    console.log('[POST /api/leads/candidates/bulk-delete]', { idsCount: Array.isArray(ids) ? ids.length : 0 });
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'Missing ids' }); return; }

    // Determine caller capabilities
    const { data: me } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .maybeSingle();
    const myTeamId = (me as any)?.team_id || null;
    const myRole = ((me as any)?.role || '').toLowerCase();
    const isSuperAdmin = myRole === 'super_admin' || myRole === 'superadmin';
    const isTeamAdmin = myRole === 'team_admin';

    let allowedIds: string[] = [];
    if (isSuperAdmin) {
      // Super admins can delete any provided ids
      allowedIds = ids as string[];
    } else if (isTeamAdmin && myTeamId) {
      // Team admins can delete their own + team-owned candidates
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', myTeamId);
      const teamUserIds = (teamUsers || []).map((u: any) => u.id);
      const { data: teamOwned } = await scoped(req, 'candidates')
        .select('id')
        .in('id', ids)
        .in('user_id', [...teamUserIds, userId]);
      allowedIds = (teamOwned || []).map((r: any) => r.id);
    } else {
      // Regular members can delete only their own candidates
      const { data: owned } = await scoped(req, 'candidates')
        .select('id')
        .in('id', ids)
        .eq('user_id', userId);
      allowedIds = (owned || []).map((r: any) => r.id);
    }

    if (allowedIds.length === 0) { res.json({ success: true, deleted: 0, notDeleted: ids }); return; }

    // Chunk deletions to avoid PostgREST URL length limits
    const chunkSize = 100;
    let deleted: string[] = [];
    const idSet = new Set<string>(allowedIds);

    // 1) Delete candidate_jobs in chunks
    for (let i = 0; i < allowedIds.length; i += chunkSize) {
      const chunk = allowedIds.slice(i, i + chunkSize);
      const { error: cjErr } = await scopedNoOwner(req, 'candidate_jobs')
        .delete()
        .in('candidate_id', chunk);
      if (cjErr) {
        console.error('[bulk-delete] candidate_jobs delete error for chunk', cjErr);
        // continue; safe to attempt candidate delete anyway
      }
    }

    // 2) Delete candidates in chunks, collect deleted ids
    for (let i = 0; i < allowedIds.length; i += chunkSize) {
      const chunk = allowedIds.slice(i, i + chunkSize);
      const { data: delRows, error: delErr } = await scoped(req, 'candidates')
        .delete()
        .in('id', chunk)
        .select('id');
      if (delErr) {
        console.error('[bulk-delete] candidates delete error for chunk', delErr);
        // skip this chunk
        continue;
      }
      if (delRows && delRows.length) {
        deleted.push(...delRows.map((r: any) => r.id));
      }
    }

    const notDeleted = (ids as string[]).filter((id) => !deleted.includes(id) && idSet.has(id));
    res.json({ success: true, deleted: deleted.length, notDeleted });
  } catch (e) {
    console.error('Bulk delete (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount the Decodo enrichment router under a scoped path to avoid route conflicts
router.use('/decodo', enrichmentRouter);

// GET /api/leads/candidates - fetch all candidates for the authenticated user
router.get('/candidates', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('GET /api/leads/candidates');
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's team_id and role for team sharing
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('team_id, role')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user team:', userError);
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    let teamSharing = DEFAULT_TEAM_SETTINGS;
    if (userData.team_id) {
      teamSharing = await fetchTeamSettingsForTeam(userData.team_id);
    }
    const shareCandidatesEnabled = !!teamSharing.share_candidates;

    // Build query based on user role
    let query = scoped(req, 'candidates')
      .select('*');

    const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
    const adminViewPool = isAdmin && teamSharing.team_admin_view_pool;
    
    let teamUserIds: string[] = [];
    if (userData.team_id) {
      const { data: teamUsers } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', userData.team_id);
      teamUserIds = (teamUsers || []).map((u: any) => u.id).filter(Boolean);
    }

    if (userData.team_id && teamUserIds.length > 0) {
      const otherTeamMembers = teamUserIds.filter(id => id !== userId);
      if (isAdmin) {
        if (adminViewPool) {
          const ids = Array.from(new Set([userId, ...teamUserIds]));
          query = query.in('user_id', ids);
        } else {
          query = query.eq('user_id', userId);
        }
      } else if (shareCandidatesEnabled) {
        const ids = Array.from(new Set([userId, ...teamUserIds]));
        query = query.in('user_id', ids);
      } else {
        if (otherTeamMembers.length > 0) {
          query = query.or(`user_id.eq.${userId},and(user_id.in.(${otherTeamMembers.join(',')}),shared.eq.true)`);
        } else {
          query = query.eq('user_id', userId);
        }
      }
    } else {
      // No team - only see own candidates
      query = query.eq('user_id', userId);
    }

    const { data: candidates, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const decorated = (candidates || []).map((candidate: any) => ({
      ...candidate,
      shared_from_team_member:
        !!userData.team_id &&
        candidate.user_id &&
        candidate.user_id !== userId &&
        teamUserIds.includes(candidate.user_id)
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.removeHeader('ETag');
    res.json(decorated);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// POST /api/leads/candidates - create a new candidate for the authenticated user
router.post('/candidates', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      title,
      linkedin_url,
      status
    } = req.body || {};

    // If no email is provided, generate a unique placeholder to satisfy NOT NULL + UNIQUE(email)
    // Format: unknown+<userprefix>+<timestamp>@noemail.hirepilot
    const providedEmail: string | undefined = typeof email === 'string' ? email.trim() : undefined;
    const safeEmail = providedEmail && providedEmail.length > 0
      ? providedEmail
      : `unknown+${(userId || '').slice(0,8)}+${Date.now()}@noemail.hirepilot`;

    // If a real email is provided, proactively check for duplicates to return a clear message
    if (providedEmail) {
      const { data: existingAny } = await scoped(req, 'candidates')
        .select('id,user_id')
        .eq('email', providedEmail)
        .maybeSingle();
      if (existingAny) {
        res.status(409).json({ error: 'candidate_email_exists', message: 'A candidate with this email already exists.' });
        return;
      }
    }

    const ALLOWED_STATUS = ['sourced','contacted','responded','interviewed','offered','hired','rejected'];
    const candidateStatus = ALLOWED_STATUS.includes(status) ? status : 'sourced';

    const insertRow: any = {
      user_id: userId,
      first_name: first_name || '',
      last_name: last_name || '',
      email: safeEmail,
      phone: phone || null,
      title: title || null,
      linkedin_url: linkedin_url || null,
      status: candidateStatus,
      enrichment_data: {},
      notes: null
    };

    const { data, error } = await scoped(req, 'candidates')
      .insert(insertRow)
      .select('*')
      .single();

    if (error) {
      // Handle duplicate key conflicts clearly
      if ((error as any)?.code === '23505') {
        res.status(409).json({ error: 'candidate_email_exists', message: 'A candidate with this email already exists.' });
        return;
      }
      res.status(500).json({ error: 'Failed to create candidate', details: (error as any)?.message || String(error) });
      return;
    }

    try {
      const { createZapEvent, EVENT_TYPES } = await import('../lib/events');
      const src = (req.body?.source || req.body?.enrichment_source || '').toString().toLowerCase();
      const allowed = new Set(['apollo','skrapp','hunter','linkedin','sourcing_campaign','sales_nav','chrome_extension']);
      const normalized = src === 'chrome extension' ? 'chrome_extension' : src;
      if (allowed.has(normalized)) {
        await createZapEvent({
          event_type: EVENT_TYPES.lead_source_added as any,
          user_id: req.user.id,
          entity: 'leads',
          entity_id: (data as any)?.id,
          payload: { source: normalized }
        });
      }
    } catch {}
    res.status(201).json(data);
  } catch (e) {
    console.error('Create candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/leads/candidates/:id/resume - upload resume file and set resume_url
router.post('/candidates/:id/resume', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id as string | undefined;
    const candidateId = req.params.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!candidateId) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    // Verify ownership
    const { data: existing, error: ownErr } = await scoped(req, 'candidates')
      .select('id, user_id')
      .eq('id', candidateId)
      .maybeSingle();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    const file = (req.body as any)?.file || {};
    const fileData: string = typeof file.data === 'string' ? file.data : '';
    const fileName: string = typeof file.name === 'string' ? file.name : 'resume.pdf';
    if (!fileData) { res.status(400).json({ error: 'Missing file data' }); return; }

    // Upload to storage using service role
    const url = process.env.SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!url || !serviceKey) { res.status(500).json({ error: 'Storage not configured' }); return; }
    const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    try {
      // Ensure storage bucket exists (idempotent)
      try {
        const { data: bucket, error: bucketErr } = await admin.storage.getBucket('uploads');
        if (bucketErr || !bucket) {
          await admin.storage.createBucket('uploads', { public: true, fileSizeLimit: '20MB' }).catch(() => {});
        }
      } catch {}

      const base64 = String(fileData).split(',').pop() || '';
      const bytes = Buffer.from(base64, 'base64');
      const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const path = `resumes/${userId}/${Date.now()}_${safeName}`;
      // Detect content type from extension
      const ext = (safeName.split('.').pop() || '').toLowerCase();
      const type = ext === 'pdf' ? 'application/pdf' : (ext === 'doc' ? 'application/msword' : (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'));
      const { error: upErr } = await admin.storage.from('uploads').upload(path, bytes, { upsert: false, contentType: type });
      if (upErr) { res.status(500).json({ error: upErr.message || 'Upload failed' }); return; }
      const { data: pub } = admin.storage.from('uploads').getPublicUrl(path);
      const publicUrl = pub?.publicUrl || null;
      if (!publicUrl) { res.status(500).json({ error: 'Failed to get public URL' }); return; }

      const { data: updated, error: updErr } = await scoped(req, 'candidates')
        .update({ resume_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', candidateId)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (updErr || !updated) { res.status(500).json({ error: 'Failed to save resume URL' }); return; }

      res.json({ success: true, candidate: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/leads/candidates/:id - update candidate via leads router (for compatibility)
router.put('/candidates/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[PUT /api/leads/candidates/:id] body=', req.body);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!id) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    const { data: existing, error: ownErr } = await scoped(req, 'candidates')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    const ALLOWED_STATUS = ['sourced','contacted','interviewed','offered','hired','rejected'];
    const { status, first_name, last_name, email, phone, notes } = req.body || {};
    const update: any = {};
    if (status) {
      if (!ALLOWED_STATUS.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
      update.status = status;
    }
    if (first_name !== undefined) update.first_name = first_name;
    if (last_name !== undefined) update.last_name = last_name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await scoped(req, 'candidates')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) { res.status(500).json({ error: 'Failed to update candidate' }); return; }
    res.json(data);
  } catch (e) {
    console.error('Update candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/leads/candidates/:id - delete candidate via leads router (for compatibility)
router.delete('/candidates/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    console.log('[DELETE /api/leads/candidates/:id] id=', req.params.id);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (!id) { res.status(400).json({ error: 'Missing candidate id' }); return; }

    const { data: existing, error: ownErr } = await scoped(req, 'candidates')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (ownErr || !existing || existing.user_id !== userId) { res.status(404).json({ error: 'Candidate not found' }); return; }

    // Remove job links first to avoid FK violations
    await scopedNoOwner(req, 'candidate_jobs')
      .delete()
      .eq('candidate_id', id);

    const { error } = await scoped(req, 'candidates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) { res.status(500).json({ error: 'Failed to delete candidate' }); return; }
    res.json({ success: true });
  } catch (e) {
    console.error('Delete candidate (leads router) error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leads - list leads for the authenticated user (mirrors candidate logic)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get campaign filter from query params
    const campaignId = req.query.campaignId as string;
    const runId = (req.query.run_id || req.query.scheduler_run_id) as string | undefined;

    // Get user's team_id and role for team sharing (supports legacy + new membership).
    const teamContext = await getUserTeamContextDb(userId);
    const userRow = {
      team_id: teamContext.teamId,
      role: teamContext.role || (req as ApiRequest).user?.role || null
    };
    const workspaceOwnerId = String(
      (req as any).workspaceId || userRow.team_id || userId
    );

    let teamSharing = DEFAULT_TEAM_SETTINGS;
    if (userRow.team_id) {
      teamSharing = await fetchTeamSettingsForTeam(userRow.team_id);
    }
    const shareLeadsEnabled = !!teamSharing.share_leads;
    const allowTeamEditing = shareLeadsEnabled && !!teamSharing.allow_team_editing;

    // Build query based on user role.
    // Use workspace scope without owner filtering so team sharing can include
    // shared leads that still have workspace_id NULL.
    let query = scopedNoOwner(req, 'leads').select('*');

    const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userRow.role);
    const adminViewPool = isAdmin && teamSharing.team_admin_view_pool;
    
    let teamUserIds: string[] = [];
    if (userRow.team_id) {
      try {
        const { data: teamUsers, error: teamUsersError } = await supabase
          .from('users')
          .select('id')
          .eq('team_id', userRow.team_id);
        if (teamUsersError) {
          console.warn('[GET /api/leads] Failed to fetch team users:', teamUsersError);
        }
        teamUserIds = (teamUsers || []).map((u: any) => u.id).filter(Boolean);
      } catch (teamUsersError) {
        console.warn('[GET /api/leads] Failed to fetch team users (exception):', teamUsersError);
      }
    }

    if (userRow.team_id && teamUserIds.length > 0) {
      const otherTeamMembers = teamUserIds.filter(id => id !== userId);
      if (isAdmin) {
        if (adminViewPool) {
          const ids = Array.from(new Set([userId, ...teamUserIds, workspaceOwnerId]));
          query = query.in('user_id', ids);
        } else if (workspaceOwnerId && workspaceOwnerId !== userId) {
          query = query.in('user_id', [userId, workspaceOwnerId]);
        } else {
          query = query.eq('user_id', userId);
        }
      } else if (shareLeadsEnabled) {
        const ids = Array.from(new Set([userId, ...teamUserIds, workspaceOwnerId]));
        query = query.in('user_id', ids);
      } else {
        if (otherTeamMembers.length > 0) {
          const orParts = [`user_id.eq.${userId}`];
          if (workspaceOwnerId && workspaceOwnerId !== userId) {
            orParts.push(`user_id.eq.${workspaceOwnerId}`);
          }
          orParts.push(`and(user_id.in.(${otherTeamMembers.join(',')}),shared.eq.true)`);
          query = query.or(orParts.join(','));
        } else {
          if (workspaceOwnerId && workspaceOwnerId !== userId) {
            query = query.in('user_id', [userId, workspaceOwnerId]);
          } else {
            query = query.eq('user_id', userId);
          }
        }
      }
    } else {
      // No team - only see own leads
      if (workspaceOwnerId && workspaceOwnerId !== userId) {
        query = query.in('user_id', [userId, workspaceOwnerId]);
      } else {
        query = query.eq('user_id', userId);
      }
    }
    
    // Add campaign filter if provided
    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }
    // Optional: filter to a specific scheduler run
    if (runId) {
      query = query.eq('scheduler_run_id', runId);
    }

    const { data: leads, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const decorated = (leads || []).map((lead: any) => {
      const sharedFromTeamMate =
        !!userRow.team_id &&
        lead.user_id &&
        lead.user_id !== userId &&
        teamUserIds.includes(lead.user_id);
      const canEdit =
        lead.user_id === userId ||
        (allowTeamEditing && sharedFromTeamMate);
      return {
        ...lead,
        shared_from_team_member: sharedFromTeamMate,
        shared_can_edit: sharedFromTeamMate && allowTeamEditing,
        can_edit: canEdit
      };
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.removeHeader('ETag');
    res.json(decorated);
  } catch (error) {
    console.error('Error fetching leads:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch leads', details: message });
  }
});

// POST /api/leads/apollo/search
router.post('/apollo/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { jobTitle, keywords, location, booleanSearch } = req.body;

    console.log('[Apollo Search] Request parameters:', {
      jobTitle,
      keywords,
      location,
      booleanSearch
    });

    // 1) Prefer the shared SUPER_ADMIN_APOLLO_API_KEY for ALL users (centralized credits)
    if (process.env.SUPER_ADMIN_APOLLO_API_KEY) {
      console.log('[Apollo Search] Using SUPER_ADMIN_APOLLO_API_KEY (global first)');

      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');

      const searchParams: any = {
        api_key: process.env.SUPER_ADMIN_APOLLO_API_KEY,
        person_locations: location ? [location] : undefined,
        page: 1,
        per_page: 100,
      };

      if (booleanSearch && keywords) {
        searchParams.person_titles = [keywords.trim()];
      } else {
        if (jobTitle) searchParams.person_titles = [jobTitle];
        if (keywords) searchParams.q_keywords = keywords;
      }

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 2) Next, try OAuth integration token if connected
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'apollo')
      .eq('status', 'connected')
      .single();

    if (integration) {
      const { data: apolloTokens } = await supabase
        .from('apollo_accounts')
        .select('access_token')
        .eq('user_id', userId)
        .single();

      if (apolloTokens?.access_token) {
        const apolloPayload = {
          q_organization_domains: [],
          title: jobTitle,
          keywords,
          location,
          page: 1,
          per_page: 10,
        };

        const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apolloTokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apolloPayload),
        });

        const data = (await response.json()) as { people?: any[]; contacts?: any[] };
        const leads = data.people || data.contacts || [];
        res.json({ leads });
        return;
      }
    }

    // 4. Fallback: Use API key from user_settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settings?.apollo_api_key) {
      console.log('[Apollo Search] Using user personal API key');
      
      // Use the CORRECT Apollo API format that actually works
      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');
      
      const searchParams: any = {
        api_key: settings.apollo_api_key,
        person_locations: location ? [location] : undefined, // ✅ Correct parameter name
        page: 1,
        per_page: 100
      };

      // Handle Boolean search mode
      if (booleanSearch && keywords) {
        // Boolean mode: Put Boolean job title search in person_titles, not q_keywords
        // Apollo supports Boolean syntax in person_titles field
        searchParams.person_titles = [keywords.trim()];
        console.log('[Apollo Search] Boolean mode enabled - using person_titles with Boolean syntax:', searchParams.person_titles);
      } else {
        // Regular mode: Use person_titles for job title and q_keywords for additional keywords
        if (jobTitle) {
          searchParams.person_titles = [jobTitle];
        }
        if (keywords) {
          searchParams.q_keywords = keywords;
        }
        console.log('[Apollo Search] Regular mode - using person_titles and q_keywords separately');
      }

      console.log('[Apollo Search] USER API KEY - Using WORKING Apollo implementation:', {
        ...searchParams,
        api_key: '***'
      });

      const { leads } = await searchAndEnrichPeople(searchParams);
      res.json({ leads });
      return;
    }

    // 4) If no shared key or OAuth, fallback to user's personal API key
    // (handled above already); if none, error out

    res.status(400).json({ 
      error: 'No Apollo integration or API key found. Please connect your Apollo account or add an API key in the settings.' 
    });
  } catch (error) {
    console.error('Error searching Apollo:', error);
    res.status(500).json({ error: 'Failed to search Apollo' });
  }
});

// POST /api/leads/import
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { campaignId, leads, source, searchCriteria } = req.body;
    if (!campaignId || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing campaignId or leads' });
      return;
    }

    // Import the CreditService
    const { CreditService } = await import('../../services/creditService');

    // Check if user has enough credits
    const hasCredits = await CreditService.hasSufficientCredits(userId, leads.length);
    if (!hasCredits) {
      res.status(402).json({ 
        error: 'Insufficient credits', 
        required: leads.length,
        message: `You need ${leads.length} credits to import these leads.`
      });
      return;
    }

    const normalizedLeads = leads.map((lead: any) => {
      const first = lead.first_name || (lead.name ? lead.name.split(' ')[0] : '') || '';
      const last = lead.last_name || (lead.name ? lead.name.split(' ').slice(1).join(' ') : '') || '';
      const locationStr = lead.location || [lead.city, lead.state, lead.country].filter(Boolean).join(', ');

      return {
        user_id: userId,
        campaign_id: campaignId,
        first_name: first,
        last_name: last,
        name: lead.name || `${first} ${last}`.trim(),
        email: lead.email || '',
        title: lead.title || '',
        company: lead.company || '',
        linkedin_url: lead.linkedin_url || null,
        city: lead.city || null,
        state: lead.state || null,
        country: lead.country || null,
        location: locationStr || null,
        enrichment_data: lead.enrichment_data ? JSON.stringify(lead.enrichment_data) : null,
        enrichment_source: lead.enrichment_source || null,
        source_meta: lead.sourceMeta ? JSON.stringify(lead.sourceMeta) : null,
        source: source || null,
        status: 'New',
        created_at: new Date().toISOString(),
      };
    });

    // Insert leads into the database
    const { data, error } = await scoped(req, 'leads')
      .insert(normalizedLeads)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Deduct credits for the imported leads
    try {
      await CreditService.useCreditsEffective(userId, leads.length);
      
      // Log the specific usage for campaign lead import
      await CreditService.logCreditUsage(
        userId, 
        leads.length, 
        'api_usage', 
        `Campaign lead import: ${leads.length} leads added to campaign ${campaignId}`
      );
    } catch (creditError) {
      console.error('Error deducting credits:', creditError);
      // Note: leads were already inserted, so we log this but don't fail the request
    }

    // Update campaign totals
    console.log('📊 Updating campaign totals for campaign:', campaignId);
    try {
      // Get total and enriched lead counts for this campaign
      const { count: totalLeads, error: totalError } = await scoped(req, 'leads')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId);

      const { count: enrichedLeads, error: enrichedError } = await scoped(req, 'leads')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .not('email', 'is', null)
        .neq('email', '');

      console.log('📊 Campaign count results:', {
        totalLeads,
        enrichedLeads,
        totalError,
        enrichedError
      });

      if (totalError) {
        console.error('Error getting total leads count:', totalError);
      }

      if (enrichedError) {
        console.error('Error getting enriched leads count:', enrichedError);
      }

      // Update campaign with new counts and source
      const campaignUpdate: any = {
        total_leads: totalLeads || 0,
        enriched_leads: enrichedLeads || 0,
        updated_at: new Date().toISOString()
      };

      // Set campaign source if provided
      if (source) {
        campaignUpdate.source = source;
      }

      const { error: campaignError } = await scoped(req, 'campaigns')
        .update(campaignUpdate)
        .eq('id', campaignId);

      if (campaignError) {
        console.error('❌ Error updating campaign counts:', campaignError);
        // Don't fail the request but log it properly
      } else {
        console.log('✅ Campaign counts updated successfully:', {
          campaignId,
          totalLeads: totalLeads || 0,
          enrichedLeads: enrichedLeads || 0
        });
      }
    } catch (countError) {
      console.error('❌ Error updating campaign counts:', countError);
      // Don't fail the request for count update errors
    }

    // Send Apollo notifications if this is an Apollo campaign
    if (source === 'apollo' && data && data.length > 0) {
      try {
        const { sendApolloSearchNotifications } = await import('../../services/apolloNotificationService');
        
        console.log('[Leads Import] Sending Apollo notifications:', {
          userId,
          campaignId,
          source,
          searchCriteria,
          leadCount: data.length
        });
        
        // Send notifications asynchronously
        sendApolloSearchNotifications(userId, campaignId, searchCriteria || {}, data.length)
          .catch(error => {
            console.error('[Leads Import] Error sending Apollo notifications:', error);
          });
      } catch (importError) {
        console.error('[Leads Import] Error importing Apollo notification service:', importError);
      }
    }

    // Fire-and-forget Slack notification for CSV/Apollo lead import
    try {
      const { data: me } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const userEmail = (me as any)?.email || 'unknown@user';
      const count = Array.isArray(data) ? data.length : 0;
      const src = source || 'csv';
      notifySlack(`📥 CSV Leads Import: ${count} leads imported by ${userEmail}${src ? ` (source: ${src})` : ''}`);
    } catch (e) {
      console.warn('[Leads Import] Slack notify failed (non-fatal):', (e as any)?.message || e);
    }

    res.json({ 
      success: true, 
      data,
      imported: data?.length || 0,
      creditsUsed: leads.length
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// POST /api/leads/bulk-add - Add scraped leads from extension with credit gating (1 credit per lead)
router.post('/bulk-add', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      res.status(400).json({ error: 'Missing leads array' });
      return;
    }

    const workspaceId = (req as any).workspaceId || null;

    // Normalize leads data from Sales Navigator scraping
    const normalizedLeads = leads.map((lead: any) => {
      const first = lead.first_name || (lead.name ? lead.name.split(' ')[0] : '') || '';
      const last = lead.last_name || (lead.name ? lead.name.split(' ').slice(1).join(' ') : '') || '';

      return {
        user_id: userId,
        workspace_id: workspaceId,
        first_name: first,
        last_name: last,
        name: lead.name || `${first} ${last}`.trim(),
        email: lead.email || '',
        title: lead.title || '',
        company: lead.company || '',
        linkedin_url: lead.profileUrl || null,
        source: 'Chrome Extension',
        enrichment_source: 'linkedin',
        enrichment_data: {
          location: lead.location || 'Unknown',
          source: 'Chrome Extension'
        },
        status: 'New',
        created_at: new Date().toISOString(),
      };
    }).filter(lead => lead.name); // Only include leads with names

    if (normalizedLeads.length === 0) {
      res.status(400).json({ error: 'No valid leads provided' });
      return;
    }

    // Check and deduct credits for Chrome extension lead scraping (1 credit per lead)
    try {
      const ok = await CreditService.hasSufficientCredits(userId, normalizedLeads.length);
      if (!ok) {
        res.status(402).json({ error: 'Insufficient credits. You need ' + normalizedLeads.length + ' credits to add these leads.' });
        return;
      }
      await CreditService.deductCredits(
        userId,
        normalizedLeads.length,
        'api_usage',
        `Chrome Extension: Scrape + import ${normalizedLeads.length} profiles`
      );
    } catch (creditError) {
      res.status(402).json({ error: 'Credit deduction failed: ' + (creditError as any)?.message || String(creditError) });
      return;
    }

    // Insert leads into the database
    const { data, error } = await supabase
      .from('leads')
      .insert(normalizedLeads)
      .select('*');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Emit source-added events for batch imports via Chrome Extension
    try {
      const { createZapEvent, EVENT_TYPES } = await import('../lib/events');
      for (const row of (data || [])) {
        await createZapEvent({
          event_type: EVENT_TYPES.lead_source_added as any,
          user_id: req.user!.id,
          entity: 'leads',
          entity_id: row.id,
          payload: { source: 'chrome_extension' }
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      data,
      added: data?.length || 0,
      creditsCharged: normalizedLeads.length,
      message: `Successfully added ${data?.length || 0} leads and charged ${normalizedLeads.length} credits`
    });
  } catch (error) {
    console.error('Error adding leads:', error);
    res.status(500).json({ error: 'Failed to add leads' });
  }
});

// (Optional) POST /api/leads/csv/parse
router.post('/csv/parse', async (req: Request, res: Response) => {
  try {
    // TODO: Parse CSV file (stream or buffer) and return preview rows
    res.json({ preview: [] });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// OLD APOLLO ROUTE REMOVED - Now using Decodo-first compatibility route above

// GET /api/leads/:id - fetch a single lead by ID (with user ownership verification)
router.get('/:id', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch the lead first
    const { data: lead, error: leadErr } = await applyWorkspaceScope(
      supabase.from('leads').select('*, user_id'),
      { workspaceId: (req as any).workspaceId, userId, ownerColumn: 'user_id' }
    )
      .eq('id', id)
      .single();

    if (leadErr || !lead) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    let sharedFromTeamMate = false;
    let shareViewAllowed = false;
    let shareEditAllowed = false;
    let privilegedSameTeam = false;

    // Allow if owner; otherwise allow if team sharing permits or privileged roles
    if (lead.user_id !== userId) {
      const { sameTeam, teamSettings, privileged } = await resolveLeadSharingContext(userId, lead.user_id);
      sharedFromTeamMate = sameTeam;
      const adminOverride = privileged && sameTeam && teamSettings.team_admin_view_pool;
      shareViewAllowed = sameTeam && (teamSettings.share_leads || adminOverride);
      shareEditAllowed = sameTeam && teamSettings.share_leads && teamSettings.allow_team_editing;
      privilegedSameTeam = privileged && sameTeam;

      let hasCandidateAccess = false;
      if (!privilegedSameTeam && !shareViewAllowed) {
        const { data: candidate } = await applyWorkspaceScope(
          supabase.from('candidates').select('id'),
          { workspaceId: (req as any).workspaceId, userId, ownerColumn: 'user_id' }
        )
          .eq('lead_id', id)
          .eq('user_id', userId)
          .single();
        hasCandidateAccess = Boolean(candidate);
      }

      if (!privilegedSameTeam && !shareViewAllowed && !hasCandidateAccess) {
        res.status(404).json({ error: 'Lead not found or access denied' });
        return;
      }
    }
    
    res.json({
      ...lead,
      shared_from_team_member: sharedFromTeamMate,
      shared_can_edit: shareEditAllowed,
      can_edit: lead.user_id === userId || shareEditAllowed || privilegedSameTeam
    });
  } catch (err) {
    console.error('Error fetching lead:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads/:id/convert - convert a lead to a candidate
router.post('/:id/convert', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id } = req.body;

  // --- PATCH: Strip 'Bearer ' prefix and verify JWT ---
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  let user, userError;
  try {
    const result = await supabase.auth.getUser(jwt);
    user = result.data.user;
    userError = result.error;
  } catch (err) {
    res.status(401).json({ error: 'JWT verification failed' });
    return;
  }
  // Decode JWT for iss/exp checks
  try {
    const { iss, exp } = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    if (!iss.startsWith(process.env.SUPABASE_URL)) {
      res.status(401).json({ error: 'token for wrong project' });
      return;
    }
    if (exp < Math.floor(Date.now()/1000)) {
      res.status(401).json({ error: 'token expired' });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: 'invalid JWT' });
    return;
  }
  if (!user) {
    res.status(401).json({ error: 'invalid or expired JWT' });
    return;
  }
  if (!user_id || user.id !== user_id) {
    res.status(401).json({ error: 'User ID mismatch or missing' });
    return;
  }
  // --- END PATCH ---

  try {
    // 1. Get the lead
    const { data: lead, error: leadError } = await scoped(req, 'leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.error('Lead fetch error:', leadError);
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Access control: allow converting your own lead OR (team_admin/admin/super_admin) converting a teammate's lead.
    // This matches the Lead detail sharing model but limits cross-user conversion to privileged roles only.
    if (String((lead as any).user_id || '') !== String(user.id)) {
      const { sameTeam, privileged } = await resolveLeadSharingContext(user.id, String((lead as any).user_id || ''));
      if (!(privileged && sameTeam)) {
        // Don't leak existence
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
    }

    // 2. Create candidate record
    let firstName = lead.first_name;
    let lastName = lead.last_name;
    if ((!firstName || !lastName) && lead.name) {
      const nameParts = lead.name.trim().split(' ');
      firstName = firstName || nameParts[0] || '';
      lastName = lastName || nameParts.slice(1).join(' ') || '';
    }
    // Ensure an email is always present to satisfy NOT NULL + UNIQUE(email)
    const providedEmail = typeof lead.email === 'string' ? lead.email.trim() : '';
    let candidateEmail = providedEmail && providedEmail.length > 0
      ? providedEmail
      : `unknown+${(user.id || '').slice(0,8)}+${Date.now()}@noemail.hirepilot`;
    const { data: candidate, error: candidateError } = await scoped(req, 'candidates')
      .insert({
        lead_id: lead.id,
        user_id: user.id,
        first_name: firstName || '',
        last_name: lastName || '',
        email: candidateEmail,
        phone: lead.phone || null,
        avatar_url: lead.avatar_url || null,
        status: 'sourced',
        enrichment_data: {
          ...(lead.enrichment_data || {}),
          current_title: lead.title || null
        },
        resume_url: null,
        notes: null,
        title: lead.title || null,
        linkedin_url: lead.linkedin_url || null
      })
      .select()
      .single();

    if (candidateError) {
      console.error('Candidate insert error:', candidateError);
      // Handle duplicate email: retry once with a unique placeholder
      if ((candidateError as any)?.code === '23505') {
        const retryEmail = `unknown+${(user.id || '').slice(0,8)}+${Date.now()}-dup@noemail.hirepilot`;
        const { data: candidate2, error: retryErr } = await scoped(req, 'candidates')
          .insert({
            lead_id: lead.id,
            user_id: user.id,
            first_name: firstName || '',
            last_name: lastName || '',
            email: retryEmail,
            phone: lead.phone || null,
            avatar_url: lead.avatar_url || null,
            status: 'sourced',
            enrichment_data: {
              ...(lead.enrichment_data || {}),
              current_title: lead.title || null
            },
            resume_url: null,
            notes: null,
            title: lead.title || null,
            linkedin_url: lead.linkedin_url || null
          })
          .select()
          .maybeSingle();
        if (retryErr || !candidate2) {
          res.status(500).json({ error: 'db error', details: retryErr || candidateError });
          return;
        }
        // Use candidate2 in downstream analytics
      } else {
        res.status(500).json({ error: 'db error', details: candidateError });
        return;
      }
    }

    // 3. Record conversion event for analytics
    try {
      await EmailEventService.storeEvent({
        user_id: user.id,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        provider: 'system',
        message_id: `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'conversion',
        metadata: {
          candidate_id: candidate.id,
          lead_name: `${firstName} ${lastName}`.trim(),
          lead_email: lead.email,
          lead_title: lead.title,
          lead_company: lead.company,
          converted_at: new Date().toISOString()
        }
      });
      console.log('✅ Conversion event recorded for analytics');
    } catch (conversionError) {
      console.error('❌ Failed to record conversion event:', conversionError);
      // Don't fail the conversion for analytics errors
    }

    // 4. Delete the lead
    const { error: deleteError } = await scoped(req, 'leads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Lead delete error:', deleteError);
      res.status(500).json({ error: 'Failed to delete lead', details: deleteError });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Lead converted to candidate successfully',
      candidate
    });
  } catch (error) {
    console.error('Convert endpoint error:', error);
    res.status(500).json({ error: 'Failed to convert lead', details: error });
  }
});

// Apollo routes are handled in backend/api/leadsApollo.ts under /api/leads/apollo

// ---------------------------------------------------------------------------
// DELETE /api/leads - bulk delete (ids[] in body) for the authenticated user
// ---------------------------------------------------------------------------
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      res.status(400).json({ error: 'No ids provided' });
      return;
    }

    const { data: deletedRows, error } = await scoped(req, 'leads')
      .delete()
      .in('id', ids)
      .eq('user_id', userId)
      .select('id');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const deleted = (deletedRows || []).map((r: any) => r.id);
    const notFound = ids.filter(id => !deleted.includes(id));

    res.status(200).json({ deleted, notFound });
  } catch (error) {
    console.error('Error deleting leads:', error);
    res.status(500).json({ error: 'Failed to delete leads' });
  }
});

// Now, define any generic /:id routes below this line

console.log('Leads routes registered');

export const getLeads = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await scoped(req, 'leads')
      .select('*')
      .eq('user_id', req.user.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

export const createLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await scoped(req, 'leads')
      .insert([{ ...req.body, user_id: req.user.id }])
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
};

export const updateLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    
    // Get the original lead data for comparison
    const { data: originalLead, error: fetchError } = await applyWorkspaceScope(
      supabase.from('leads').select('*'),
      { workspaceId: (req as any).workspaceId, userId: req.user.id, ownerColumn: 'user_id' }
    )
      .eq('id', id)
      .single();

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    const isOwner = originalLead.user_id === req.user.id;
    let canEdit = isOwner;
    if (!canEdit) {
      const { sameTeam, teamSettings, privileged } = await resolveLeadSharingContext(req.user.id, originalLead.user_id);
      const shareAllowsEdit = sameTeam && teamSettings.share_leads && teamSettings.allow_team_editing;
      canEdit = (privileged && sameTeam) || shareAllowsEdit;
    }
    if (!canEdit) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!originalLead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Sanitize and map incoming payload to allowed DB columns (avoid camelCase like createdAt)
    const body = (req.body || {}) as any;
    const updatePayload: any = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.company !== undefined) updatePayload.company = body.company;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.linkedin_url !== undefined) updatePayload.linkedin_url = body.linkedin_url;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.tags !== undefined) updatePayload.tags = body.tags;
    if (body.location !== undefined) updatePayload.location = body.location;
    updatePayload.updated_at = new Date().toISOString();

    // Update the lead, handling unique email conflicts gracefully
    let { data, error } = await applyWorkspaceScope(
      supabase.from('leads').update(updatePayload),
      { workspaceId: (req as any).workspaceId, userId: req.user.id, ownerColumn: 'user_id' }
    )
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && (error as any)?.code === '23505' && req.body?.email) {
      // If the email conflicts, return a clear 409 for the frontend to display
      res.status(409).json({ error: 'lead_email_exists', message: 'A lead with this email already exists.' });
      return;
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Automation: if GTM-Lead tag is newly added, send GTM guide access email to the lead.
    // IMPORTANT: only trigger on tag addition, and only for that specific tag.
    try {
      const normalize = (t: string) => String(t || '').trim().toLowerCase().replace(/\s+/g, '-');
      const isGtmTag = (t: string) => normalize(t) === 'gtm-lead';
      const prevTags = new Set<string>(((originalLead.tags || []) as any[]).map((t) => normalize(String(t || ''))));
      const nextTagsArr = Array.isArray(req.body?.tags) ? (req.body.tags as any[]) : null;
      if (nextTagsArr) {
        const nextNorm = new Set<string>(nextTagsArr.map((t) => normalize(String(t || ''))));
        const added = Array.from(nextNorm).filter((t) => !prevTags.has(t));
        const gtmWasAdded = added.some(isGtmTag);
        const leadEmail = (data as any)?.email ? String((data as any).email) : '';
        if (gtmWasAdded && leadEmail) {
          const firstName =
            (data as any)?.first_name ||
            String((data as any)?.name || '').trim().split(/\s+/)[0] ||
            'there';
          // Fire-and-forget; do not block lead update
          sendGtmStrategyAccessEmail({
            to: leadEmail,
            firstName,
          }).catch((e: any) => console.warn('[leads] GTM access email failed', e?.message || e));
        }
      }
    } catch (e) {
      // non-fatal
    }

    // Sync changes to the corresponding candidate record if it exists
    try {
      const { data: candidate } = await applyWorkspaceScope(
        supabase.from('candidates').select('id'),
        { workspaceId: (req as any).workspaceId, userId: req.user.id, ownerColumn: 'user_id' }
      )
        .eq('lead_id', id)
        .eq('user_id', originalLead.user_id)
        .maybeSingle();

      if (candidate) {
        const candidateUpdate: any = {};
        if (req.body.first_name !== undefined) candidateUpdate.first_name = req.body.first_name;
        if (req.body.last_name !== undefined) candidateUpdate.last_name = req.body.last_name;
        if (req.body.email !== undefined) candidateUpdate.email = req.body.email;
        if (req.body.phone !== undefined) candidateUpdate.phone = req.body.phone;
        
        // Only update candidate if there are fields to sync
        if (Object.keys(candidateUpdate).length > 0) {
          await applyWorkspaceScope(
            supabase.from('candidates').update(candidateUpdate),
            { workspaceId: (req as any).workspaceId, userId: req.user.id, ownerColumn: 'user_id' }
          )
            .eq('id', candidate.id)
            .eq('user_id', req.user.id);
        }
      }
    } catch (candidateSyncError) {
      console.warn('Failed to sync lead update to candidate:', candidateSyncError);
      // Don't fail the lead update if candidate sync fails
    }

    // Emit Zapier events
    try {
      await import('../../lib/zapEventEmitter').then(async ({ emitZapEvent, ZAP_EVENT_TYPES, createLeadEventData }) => {
        // Always emit lead updated event
        emitZapEvent({
          userId: req.user!.id,
          eventType: ZAP_EVENT_TYPES.LEAD_UPDATED,
          eventData: createLeadEventData(data, { 
            previous_status: originalLead.status,
            updated_fields: Object.keys(req.body)
          }),
          sourceTable: 'leads',
          sourceId: data.id
        });

        // If status changed, emit stage changed event
        if (req.body.status && req.body.status !== originalLead.status) {
          emitZapEvent({
            userId: req.user!.id,
            eventType: ZAP_EVENT_TYPES.LEAD_STAGE_CHANGED,
            eventData: createLeadEventData(data, {
              old_status: originalLead.status,
              new_status: req.body.status,
            }),
            sourceTable: 'leads',
            sourceId: data.id
          });
        }

        // If tags changed, emit dedicated tag-added events for any newly added tags
        if (Array.isArray(req.body.tags) && JSON.stringify(req.body.tags) !== JSON.stringify(originalLead.tags)) {
          const prev = new Set<string>((originalLead.tags || []) as any);
          const next = new Set<string>((req.body.tags || []) as any);
          const added: string[] = [];
          next.forEach((t: string) => { if (!prev.has(t)) added.push(t); });
          added.forEach((tag) => {
            try {
              emitZapEvent({
                userId: req.user!.id,
                eventType: ZAP_EVENT_TYPES.LEAD_TAG_ADDED,
                eventData: createLeadEventData(data, {
                  tag,
                  action: 'tag_added',
                  tags: req.body.tags || [],
                  previous_tags: originalLead.tags || [],
                  added_tags: added
                }),
                sourceTable: 'leads',
                sourceId: data.id
              });
            } catch {}
          });
        }
      });
    } catch (zapierError) {
      console.error('Error emitting Zapier events:', zapierError);
      // Don't fail the request if Zapier events fail
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

export const deleteLead = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { error } = await scoped(req, 'leads')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

export const getLeadById = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { data, error } = await scoped(req, 'leads')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

// Add PATCH/PUT routes for lead updates (compat with frontend)
router.patch('/:id', requireAuth, updateLead);
router.put('/:id', requireAuth, updateLead);
// Add DELETE route for single-lead deletion
router.delete('/:id', requireAuth, deleteLead);

// Attach leads to campaign endpoint
router.post('/attach-to-campaign', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { leadIds, campaignId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lead IDs are required'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    // Verify that the user owns the campaign
    const { data: campaign, error: campaignError } = await scoped(req, 'campaigns')
      .select('id, name, title')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or access denied'
      });
    }

    // Normalize and validate leadIds
    const ids: string[] = Array.from(new Set((leadIds as any[]).map((x) => String(x).trim())));
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter((id) => !uuidRe.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid leadIds provided: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '…' : ''}`
      });
    }

    // Helper: retry wrapper to smooth transient fetch issues to Supabase
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const execWithRetry = async <T>(factory: () => Promise<{ data: T; error: any }>, tries = 3, baseDelay = 200) => {
      let lastErr: any = null;
      for (let attempt = 1; attempt <= tries; attempt++) {
        const { data, error } = await factory();
        if (!error) return { data, error: null } as { data: T; error: null };
        lastErr = error;
        if (attempt < tries) await delay(baseDelay * attempt);
      }
      throw lastErr;
    };

    // Verify that the user owns all the leads (chunked to avoid URL size limits)
    let ownedIds: string[] = [];
    const OWNERSHIP_CHUNK = 150; // keep URL comfortably <8KB (UUID ~36 chars)
    for (let i = 0; i < ids.length; i += OWNERSHIP_CHUNK) {
      const chunk = ids.slice(i, i + OWNERSHIP_CHUNK);
      try {
        const { data: chunkRows } = await execWithRetry<any[]>(async () =>
          await scoped(req, 'leads')
            .select('id')
            .in('id', chunk)
            .eq('user_id', userId)
        );
        ownedIds = ownedIds.concat((chunkRows || []).map((r: any) => r.id));
      } catch (fetchErr: any) {
        logAttachToCampaignError('verify-lead-ownership', fetchErr, {
          userId,
          campaignId,
          chunkSize: chunk.length,
          chunkSample: chunk.slice(0, 5)
        });
        return res.status(503).json({
          success: false,
          error: `Failed to verify lead ownership: ${summarizeSupabaseError(fetchErr)}`
        });
      }
    }

    if (ownedIds.length !== ids.length) {
      return res.status(403).json({
        success: false,
        error: 'Some leads not found or access denied'
      });
    }

    // Normalize blank LinkedIn URLs so that leads without profiles can still share campaigns
    const SANITIZE_CHUNK = 150;
    for (let i = 0; i < ownedIds.length; i += SANITIZE_CHUNK) {
      const chunk = ownedIds.slice(i, i + SANITIZE_CHUNK);
      try {
        await execWithRetry<null>(async () =>
          await scoped(req, 'leads')
            .update({ linkedin_url: null })
            .in('id', chunk)
            .eq('user_id', userId)
            .eq('linkedin_url', '')
        );
      } catch (sanitizeErr: any) {
        logAttachToCampaignError('sanitize-linkedin-url', sanitizeErr, {
          userId,
          campaignId,
          chunkSize: chunk.length,
          chunkSample: chunk.slice(0, 5)
        });
        return res.status(503).json({
          success: false,
          error: `Failed to normalize LinkedIn URLs before attachment: ${summarizeSupabaseError(sanitizeErr)}`
        });
      }
    }

    // Update the campaign_id for all the leads
    const nowIso = new Date().toISOString();
    const UPDATE_CHUNK = 150;
    for (let i = 0; i < ownedIds.length; i += UPDATE_CHUNK) {
      const chunk = ownedIds.slice(i, i + UPDATE_CHUNK);
      try {
        await execWithRetry<null>(async () =>
          await scoped(req, 'leads')
            .update({ campaign_id: campaignId, updated_at: nowIso })
            .in('id', chunk)
            .eq('user_id', userId)
        );
      } catch (fetchErr: any) {
        logAttachToCampaignError('bulk-update-leads', fetchErr, {
          userId,
          campaignId,
          chunkSize: chunk.length,
          chunkSample: chunk.slice(0, 5)
        });
        return res.status(503).json({
          success: false,
          error: `Failed to attach leads to campaign: ${summarizeSupabaseError(fetchErr)}`
        });
      }
    }

    // If the campaign is currently in draft, flip it to active
    try {
      const { data: c, error: fetchCampaignStatusErr } = await scoped(req, 'campaigns')
        .select('id, status')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single();
      if (!fetchCampaignStatusErr && c && (c as any).status === 'draft') {
        const { error: setActiveErr } = await scoped(req, 'campaigns')
          .update({ status: 'active' })
          .eq('id', campaignId)
          .eq('user_id', userId);
        if (setActiveErr) {
          console.warn('Failed to auto-activate campaign after attaching leads:', setActiveErr);
        }
      }
    } catch (e) {
      console.warn('Non-fatal: could not set campaign active after attaching leads', e);
    }

    res.json({
      success: true,
      message: `Successfully attached ${ids.length} lead(s) to campaign`,
      campaignName: campaign.name || campaign.title,
      attachedLeads: ids.length
    });

  } catch (error) {
    logAttachToCampaignError('unhandled', error, { userId: req.user?.id, campaignId: req.body?.campaignId });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.post('/:id/linkedin-connect', requireAuth, async (req: ApiRequest, res: Response) => {
  await handleLeadRemoteAction(req, res, 'connect_request');
});

router.post('/:id/linkedin-message', requireAuth, async (req: ApiRequest, res: Response) => {
  await handleLeadRemoteAction(req, res, 'send_message');
});

export default router; 

async function handleLeadRemoteAction(req: ApiRequest, res: Response, action: LinkedInRemoteActionType) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const leadId = req.params.id;
    if (!leadId) return res.status(400).json({ error: 'Lead ID is required' });

    const eligibility = await canUseRemoteLinkedInActions(userId);
    if (!eligibility.allowed) {
      return res.status(403).json({
        error: eligibility.reason || 'Remote LinkedIn actions are not enabled for this workspace.'
      });
    }

    const hasCookieOnFile = await hasLinkedInCookie(userId);
    if (!hasCookieOnFile) {
      return res.status(412).json({
        error: 'LinkedIn cookies missing. Refresh your session in Settings to use remote actions.',
        action_required: 'refresh_cookie'
      });
    }

    const lead = await fetchLeadForRemoteAction(userId, leadId, (req as any).workspaceId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found or access denied' });
    }

    if (!lead.linkedin_url) {
      return res.status(400).json({ error: 'Lead is missing a LinkedIn URL' });
    }

    const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : undefined;
    const message = rawMessage ? rawMessage.slice(0, 450) : undefined;

    if (action === 'send_message' && !message) {
      return res.status(400).json({ error: 'A LinkedIn message is required.' });
    }

    await enqueueLinkedInRemoteAction({
      userId,
      accountId: lead.account_id || null,
      leadId: lead.id,
      action,
      linkedinUrl: lead.linkedin_url,
      message,
      triggeredBy: userId
    });

    return res.status(202).json({ status: 'queued' });
  } catch (err: any) {
    console.error('[Leads] Remote LinkedIn action failed', { action, error: err?.message || err });
    return res.status(500).json({ error: 'Failed to queue remote LinkedIn action' });
  }
}

async function fetchLeadForRemoteAction(userId: string, leadId: string, workspaceId?: string | null) {
  try {
    const { data, error } = await applyWorkspaceScope(
      supabase.from('leads'),
      { workspaceId, userId, ownerColumn: 'user_id' }
    )
      .select('id, user_id, account_id, linkedin_url')
      .eq('id', leadId)
      .maybeSingle();

    if (error || !data || data.user_id !== userId) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('[Leads] fetchLeadForRemoteAction failed', err);
    return null;
  }
}

function getRequestUserId(req: ApiRequest): string | null {
  return req.user?.id || (req.headers['x-user-id'] as string | undefined) || null;
}