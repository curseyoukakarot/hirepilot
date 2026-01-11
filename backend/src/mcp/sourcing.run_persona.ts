import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { buildSourcingQuery } from '../lib/personaMapper';
import { searchPeople, enrichBatch } from '../../utils/apolloApi';
import { addLeads, queueInitialOutreachForNewLeads } from '../services/sourcing';
import { callGptJsonWithRetry, JudgeResultsQualitySchema, ProposeQueryVariantsSchema, PROMPT_JUDGE_RESULTS_QUALITY, PROMPT_PROPOSE_QUERY_VARIANTS } from '../services/agenticSourcing/gptContracts';

export const sourcingRunPersonaTool = {
  name: 'sourcing.run_persona',
  description: 'Run an end-to-end sourcing flow for a persona',
  parameters: z.object({
    userId: z.string(),
    persona_id: z.string(),
    batch_size: z.number().int().positive().max(500).optional(),
    campaign_id: z.string().optional(),
    auto_send: z.boolean().optional(),
    credit_mode: z.enum(['base','enhanced']).optional(),
    auto_outreach_enabled: z.boolean().optional(),
    linked_campaign_id: z.string().optional(),
    linked_persona_id: z.string().optional(),
    schedule_id: z.string().optional(),
    leads_per_run: z.number().int().positive().max(500).optional(),
    send_delay_minutes: z.number().int().nonnegative().optional(),
    daily_send_cap: z.number().int().positive().optional()
  }),
  handler: async (args: any) => {
    const userId: string = args.userId;
    const personaId: string = args.persona_id;
    const leadsPerRun: number = Math.max(1, Math.min(Number(args.leads_per_run ?? args.batch_size ?? 50), 500));
    const campaignId: string | undefined = args.linked_campaign_id || args.campaign_id;
    const autoSendInput: boolean = Boolean(args.auto_send);
    const autoOutreachEnabled: boolean = Boolean(args.auto_outreach_enabled ?? autoSendInput);
    const creditMode: string = args.credit_mode || 'base';
    const sendDelayMinutes: number = typeof args.send_delay_minutes === 'number' ? Math.max(0, args.send_delay_minutes) : 0;
    const dailySendCap: number | null = typeof args.daily_send_cap === 'number' ? Math.max(1, args.daily_send_cap) : null;
    const scheduleId: string | null = args.schedule_id || null;
    const startedAt = new Date();

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const emailCoverageLabel = (pct: number) => (pct >= 70 ? '(strong)' : pct >= 40 ? '(moderate)' : '(low)');
    const failureModeLabel = (mode: string) => ({
      too_narrow: 'Search too narrow',
      geo_mismatch: 'Location mismatch',
      title_drift: 'Title drift',
      deliverability_low: 'Low deliverability',
      duplicates_high: 'Too many duplicates',
      irrelevant_industries: 'Industry mismatch',
      other: 'Needs review'
    } as any)[mode] || 'Needs review';

    // 1) Load persona (ownership enforced by user_id check)
    const { data: persona, error: pErr } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', userId)
      .single();
    if (pErr || !persona) throw new Error('Persona not found');

    // Optional: load schedule preferences ("memory") for agentic loop
    let schedulePrefs: any = {};
    let prevConsecutiveFailures = 0;
    if (scheduleId) {
      try {
        const { data: sched } = await supabaseAdmin
          .from('schedules')
          .select('id,agentic_prefs,consecutive_failures')
          .eq('id', scheduleId)
          .eq('user_id', userId)
          .maybeSingle();
        schedulePrefs = (sched as any)?.agentic_prefs || {};
        prevConsecutiveFailures = Number((sched as any)?.consecutive_failures || 0);
      } catch {}
    }

    // 2) Map to sourcing query (structural only in V1)
    const targeting = buildSourcingQuery({
      name: persona.name,
      titles: persona.titles || [],
      include_keywords: persona.include_keywords || [],
      exclude_keywords: persona.exclude_keywords || [],
      locations: persona.locations || [],
      channels: persona.channels || [],
      goal_total_leads: persona.goal_total_leads || 0
    } as any);

    // 3) Ensure sourcing campaign
    let effectiveCampaignId = campaignId;
    const scheduleProvidedCampaign = Boolean(campaignId);
    if (!effectiveCampaignId) {
      // Create a lightweight campaign shell for persona run
      const { data: campRow, error: cErr } = await supabaseAdmin
        .from('sourcing_campaigns')
        .insert({ title: `Persona • ${persona.name}`, created_by: userId, audience_tag: 'rex' })
        .select('id')
        .single();
      if (cErr) throw new Error(cErr.message);
      effectiveCampaignId = (campRow as any).id;
    }
    // If this is a scheduler-triggered run and no campaign was provided, persist it on the schedule
    // so recurring runs reuse the same sourcing campaign (prevents dozens of blank campaigns).
    if (scheduleId && effectiveCampaignId && !scheduleProvidedCampaign) {
      try {
        await supabaseAdmin
          .from('schedules')
          .update({
            campaign_id: effectiveCampaignId,
            linked_campaign_id: effectiveCampaignId,
            persona_id: personaId,
            linked_persona_id: personaId,
          })
          .eq('id', scheduleId)
          .eq('user_id', userId);
      } catch {}
    }
    // 4) Resolve Apollo API key
    let apiKey: string | undefined = process.env.SUPER_ADMIN_APOLLO_API_KEY || undefined;
    if (!apiKey) {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('apollo_api_key')
        .eq('user_id', userId)
        .maybeSingle();
      apiKey = (settings as any)?.apollo_api_key || undefined;
    }
    if (!apiKey) {
      throw new Error('Apollo not configured for this workspace');
    }

    // -------------------------
    // 5) Agentic loop (max 4 attempts)
    // -------------------------
    const baselineParams = {
      person_titles: (targeting.title_query || []).length ? [(targeting.title_query || []).join(' OR ')] : undefined,
      person_locations: (targeting.locations || []).length ? [(targeting.locations || [])[0]] : undefined,
      q_keywords: (targeting.keyword_includes || []).join(' ') || undefined,
      page_strategy: { start_page: 1, max_pages: 3 },
    };

    const usedSignatures = new Set<string>();
    const attempts: any[] = [];
    let accepted: any = null;
    let decision: 'ACCEPT_RESULTS' | 'ITERATE' | 'FALLBACK' | 'NOTIFY_USER' = 'ITERATE';
    let failureMode: any = 'other';
    let qualityScore = 0;
    let confidence = 0;

    const signature = (p: any) => JSON.stringify({
      person_titles: p?.person_titles || null,
      person_locations: p?.person_locations || null,
      q_keywords: p?.q_keywords || null,
      start_page: p?.page_strategy?.start_page || 1,
      max_pages: p?.page_strategy?.max_pages || 1,
    });

    const enforceGuardrails = (candidate: any, attemptIdx: number) => {
      const c = JSON.parse(JSON.stringify(candidate || {}));
      // Normalize
      if (c?.person_titles && !Array.isArray(c.person_titles)) c.person_titles = [String(c.person_titles)];
      if (c?.person_locations && !Array.isArray(c.person_locations)) c.person_locations = [String(c.person_locations)];
      if (typeof c?.q_keywords !== 'string') c.q_keywords = c?.q_keywords ? String(c.q_keywords) : undefined;
      if (!c.page_strategy) c.page_strategy = { start_page: 1, max_pages: 3 };
      c.page_strategy.start_page = Math.max(1, Number(c.page_strategy.start_page || 1));
      c.page_strategy.max_pages = Math.max(1, Math.min(Number(c.page_strategy.max_pages || 3), 10));

      // Enforce: do not drop ALL constraints at once
      const hasTitles = Array.isArray(c.person_titles) && c.person_titles.filter(Boolean).length > 0;
      const hasLoc = Array.isArray(c.person_locations) && c.person_locations.filter(Boolean).length > 0;
      const hasKw = !!(c.q_keywords && String(c.q_keywords).trim().length);
      const families = [hasTitles, hasLoc, hasKw].filter(Boolean).length;
      if (families < 2) {
        // restore baseline-like constraints
        c.person_titles = baselineParams.person_titles;
        c.person_locations = baselineParams.person_locations;
        c.q_keywords = baselineParams.q_keywords;
      }

      // Enforce: never loosen ALL constraints in one step (baseline must remain represented)
      if (attemptIdx <= 2) {
        if (baselineParams.person_locations && !c.person_locations) c.person_locations = baselineParams.person_locations;
        if (baselineParams.person_titles && !c.person_titles) c.person_titles = baselineParams.person_titles;
      }

      return c;
    };

    const searchOnce = async (params: any) => {
      const per_page = 100;
      const page = Math.max(1, Number(params?.page_strategy?.start_page || 1));
      const resp = await searchPeople({
        api_key: apiKey,
        person_titles: params.person_titles,
        person_locations: params.person_locations,
        q_keywords: params.q_keywords,
        page,
        per_page
      } as any);
      const hits = Array.isArray((resp as any)?.people) ? (resp as any).people : [];
      return { hits, page, per_page };
    };

    const computeObservation = async (params: any, hits: any[]) => {
      const limited = hits.slice(0, 50);
      const titles = limited.map((h: any) => String(h.title || h.job_title || '').trim()).filter(Boolean);
      const locs = limited.map((h: any) => [h.city, h.state, h.country].filter(Boolean).join(', ')).filter(Boolean);
      const titleTop: Record<string, number> = {};
      const locTop: Record<string, number> = {};
      titles.forEach(t => { titleTop[t] = (titleTop[t] || 0) + 1; });
      locs.forEach(l => { locTop[l] = (locTop[l] || 0) + 1; });
      const topTitles = Object.entries(titleTop).sort((a,b)=>b[1]-a[1]).slice(0, 8);
      const topLocs = Object.entries(locTop).sort((a,b)=>b[1]-a[1]).slice(0, 8);

      const emails = limited.map((h: any) => (h?.email ? String(h.email).trim().toLowerCase() : '')).filter(Boolean);
      const emailCoveragePct = limited.length ? Math.round((emails.length / limited.length) * 100) : 0;

      // Estimate duplicates against existing campaign leads by email (best-effort)
      let dupCount = 0;
      if (effectiveCampaignId && emails.length) {
        try {
          const uniq = Array.from(new Set(emails)).slice(0, 100);
          const { data: existing } = await supabaseAdmin
            .from('sourcing_leads')
            .select('email')
            .eq('campaign_id', effectiveCampaignId)
            .in('email', uniq);
          dupCount = (existing || []).length;
        } catch {}
      }

      const personaTitles = Array.isArray(persona.titles) ? persona.titles.map((s: any) => String(s).toLowerCase()) : [];
      const personaLocs = Array.isArray(persona.locations) ? persona.locations.map((s: any) => String(s).toLowerCase()) : [];
      const titleMatch = limited.filter((h: any) => {
        const t = String(h.title || h.job_title || '').toLowerCase();
        return personaTitles.length ? personaTitles.some(pt => pt && t.includes(pt)) : false;
      }).length;
      const geoMatch = limited.filter((h: any) => {
        const l = [h.city, h.state, h.country].filter(Boolean).join(', ').toLowerCase();
        return personaLocs.length ? personaLocs.some(pl => pl && l.includes(pl)) : false;
      }).length;
      const titleMatchPct = personaTitles.length && limited.length ? Math.round((titleMatch / limited.length) * 100) : 0;
      const geoMatchPct = personaLocs.length && limited.length ? Math.round((geoMatch / limited.length) * 100) : 0;

      // If email coverage isn't visible in search hits, do a limited enrich on 10 ids.
      let enrichedSampleEmailPct: number | null = null;
      if (emailCoveragePct === 0 && limited.length) {
        try {
          const ids = limited.slice(0, 10).map((h: any) => h.id).filter(Boolean);
          if (ids.length) {
            const enriched = await enrichBatch(apiKey, ids);
            const withEmail = (enriched || []).filter((r: any) => !!r?.email).length;
            enrichedSampleEmailPct = Math.round((withEmail / ids.length) * 100);
          }
        } catch {}
      }

      const sampleLeads = limited.slice(0, 20).map((h: any) => ({
        first_name: h.first_name,
        last_name: h.last_name,
        title: h.title || h.job_title,
        company: h.organization?.name || h.company?.name,
        city: h.city,
        state: h.state,
        country: h.country,
        email: h.email || null,
        linkedin_url: h.linkedin_url || null,
      }));

      return {
        found_count: hits.length,
        sampled_count: limited.length,
        top_titles: topTitles,
        top_locations: topLocs,
        email_coverage_pct: enrichedSampleEmailPct ?? emailCoveragePct,
        email_coverage_label: emailCoverageLabel(enrichedSampleEmailPct ?? emailCoveragePct),
        duplicates_estimate: dupCount,
        geo_match_pct: geoMatchPct,
        title_match_pct: titleMatchPct,
        sample_leads: sampleLeads,
        query_used: params,
      };
    };

    // Load run history (last 1-3) for GPT context
    let runHistory: any[] = [];
    if (scheduleId) {
      try {
        const { data: logs } = await supabaseAdmin
          .from('schedule_run_logs')
          .select('id,ran_at,quality_score,confidence,decision,failure_mode,metrics,accepted_query')
          .eq('schedule_id', scheduleId)
          .order('ran_at', { ascending: false })
          .limit(3);
        runHistory = logs || [];
      } catch {}
    }

    const usedQualityScores: number[] = [];

    for (let attemptIdx = 1; attemptIdx <= 4; attemptIdx++) {
      let candidateParams = baselineParams;

      if (attemptIdx > 1) {
        // If user chose to keep criteria for a window, do not expand beyond baseline.
        const forceBaselineUntil = schedulePrefs?.force_baseline_until ? new Date(schedulePrefs.force_baseline_until) : null;
        const forceBaseline = forceBaselineUntil && forceBaselineUntil.getTime() > Date.now();
        if (!forceBaseline) {
          const priorObs = attempts.length ? attempts[attempts.length - 1]?.observation : null;
          const priorJudge = attempts.length ? attempts[attempts.length - 1]?.judge : null;

          const proposeInput = {
            persona: {
              name: persona.name,
              titles: persona.titles || [],
              locations: persona.locations || [],
              include_keywords: persona.include_keywords || [],
              exclude_keywords: persona.exclude_keywords || [],
            },
            schedule_preferences: {
              expansion_style: schedulePrefs?.expansion_style || 'conservative',
              force_baseline_until: schedulePrefs?.force_baseline_until || null,
            },
            run_history: (runHistory || []).map((l: any) => ({
              ran_at: l.ran_at,
              quality_score: l.quality_score,
              confidence: l.confidence,
              decision: l.decision,
              failure_mode: l.failure_mode,
              accepted_query: l.accepted_query || null,
            })),
            previous_attempt: priorObs ? { observation: priorObs, judge: priorJudge } : null,
            guardrails: {
              location_expansion_max: 'metro -> region -> state -> country',
              title_drift_max: 'adjacent title families only',
              keyword_relax_order: 'nice-to-haves before must-haves',
              never_loosen_all_constraints_in_one_step: true,
              max_variants: 6,
            },
          };

          const propose = await callGptJsonWithRetry({
            name: 'PROPOSE_QUERY_VARIANTS',
            schema: ProposeQueryVariantsSchema,
            system: PROMPT_PROPOSE_QUERY_VARIANTS,
            user: JSON.stringify(proposeInput),
          });

          if (propose.ok) {
            const variants = (propose.value as any).variants || [];
            // pick first unused
            const picked = variants.find((v: any) => {
              const s = signature(v.apollo_params);
              return !usedSignatures.has(s);
            }) || variants[0];
            if (picked?.apollo_params) candidateParams = { ...picked.apollo_params };
          } else {
            // Deterministic fallback: paginate deeper on later attempts
            candidateParams = {
              ...baselineParams,
              page_strategy: { start_page: attemptIdx, max_pages: Math.min(5, attemptIdx + 1) },
            };
          }
        }
      }

      candidateParams = enforceGuardrails(candidateParams, attemptIdx);
      const sig = signature(candidateParams);
      if (usedSignatures.has(sig)) {
        // Avoid infinite loops; nudge page
        candidateParams.page_strategy.start_page = Math.min(10, Number(candidateParams.page_strategy.start_page || 1) + 1);
      }
      usedSignatures.add(signature(candidateParams));

      const { hits } = await searchOnce(candidateParams);
      const observation = await computeObservation(candidateParams, hits);

      const judgeInput = {
        persona_constraints: {
          titles: persona.titles || [],
          locations: persona.locations || [],
          include_keywords: persona.include_keywords || [],
          exclude_keywords: persona.exclude_keywords || [],
        },
        query_used: candidateParams,
        metrics: {
          found_count: observation.found_count,
          sampled_count: observation.sampled_count,
          email_coverage_pct: observation.email_coverage_pct,
          geo_match_pct: observation.geo_match_pct,
          title_match_pct: observation.title_match_pct,
          duplicates_estimate: observation.duplicates_estimate,
        },
        distributions: {
          top_titles: observation.top_titles,
          top_locations: observation.top_locations,
        },
        sampled_leads: observation.sample_leads,
      };

      const judge = await callGptJsonWithRetry({
        name: 'JUDGE_RESULTS_QUALITY',
        schema: JudgeResultsQualitySchema,
        system: PROMPT_JUDGE_RESULTS_QUALITY,
        user: JSON.stringify(judgeInput),
      });

      const judgeValue = judge.ok
        ? judge.value
        : {
          quality_score: 0,
          confidence: 0,
          decision: 'FALLBACK',
          failure_mode: 'other',
          reasons_good: [],
          reasons_bad: [String((judge as any)?.error || 'invalid_gpt_output')],
          recommended_adjustment: { type: 'paginate', notes: String((judge as any)?.error || 'invalid_gpt_output') },
        };

      qualityScore = Number((judgeValue as any).quality_score || 0);
      confidence = Number((judgeValue as any).confidence || 0);
      decision = (judgeValue as any).decision;
      failureMode = (judgeValue as any).failure_mode || 'other';

      // Heuristic safety net (hard metrics):
      // For simple title-only personas (no keywords/locations), don't block on GPT;
      // if Apollo returns hits, treat it as acceptable and proceed to enrich/insert.
      const personaHasKeywords = Array.isArray(persona.include_keywords) && persona.include_keywords.filter(Boolean).length > 0;
      const personaHasLocations = Array.isArray(persona.locations) && persona.locations.filter(Boolean).length > 0;
      if (!personaHasKeywords && !personaHasLocations && observation.found_count > 0) {
        if (decision !== 'ACCEPT_RESULTS') {
          decision = 'ACCEPT_RESULTS';
          failureMode = 'other';
        }
      }

      usedQualityScores.push(qualityScore);

      attempts.push({
        attempt: attemptIdx,
        apollo_params: candidateParams,
        observation,
        judge: judgeValue,
      });

      console.log(JSON.stringify({
        event: 'agentic_sourcing_attempt',
        schedule_id: scheduleId,
        user_id: userId,
        persona_id: personaId,
        campaign_id: effectiveCampaignId,
        attempt: attemptIdx,
        found_count: observation.found_count,
        email_coverage_pct: observation.email_coverage_pct,
        geo_match_pct: observation.geo_match_pct,
        title_match_pct: observation.title_match_pct,
        quality_score: qualityScore,
        confidence,
        decision,
        failure_mode: failureMode,
      }));

      if (decision === 'ACCEPT_RESULTS') {
        accepted = { apollo_params: candidateParams, observation, judge: judgeValue };
        break;
      }
      if (decision === 'NOTIFY_USER') break;

      // Diminishing returns: if we don't improve by >=5 across 2 attempts, allow fallback.
      if (usedQualityScores.length >= 3) {
        const a = usedQualityScores[usedQualityScores.length - 3];
        const b = usedQualityScores[usedQualityScores.length - 2];
        const c = usedQualityScores[usedQualityScores.length - 1];
        if ((b - a) < 5 && (c - b) < 5 && attemptIdx >= 3) {
          // Stop iterating; the next loop will be the final attempt anyway.
        }
      }
    }

    // If no acceptance, do not enrich (avoid cost) and notify user on repeated failures.
    const chosen = accepted;
    let leadsToInsert: any[] = [];
    let foundCountFinal = chosen?.observation?.found_count || 0;
    let emailCoveragePctFinal = chosen?.observation?.email_coverage_pct || 0;
    let geoMatchPctFinal = chosen?.observation?.geo_match_pct || 0;
    let titleMatchPctFinal = chosen?.observation?.title_match_pct || 0;
    let dedupedEstimateFinal = chosen?.observation?.duplicates_estimate || 0;

    if (chosen) {
      // Full fetch (paged) + enrich only after acceptance
      const ps = chosen.apollo_params?.page_strategy || { start_page: 1, max_pages: 3 };
      const startPage = Math.max(1, Number(ps.start_page || 1));
      const maxPages = Math.max(1, Math.min(Number(ps.max_pages || 3), 10));
      const perPage = 100;

      const allHits: any[] = [];
      const seen = new Set<string>();
      for (let p = startPage; p < startPage + maxPages; p++) {
        const resp = await searchPeople({
          api_key: apiKey,
          person_titles: chosen.apollo_params.person_titles,
          person_locations: chosen.apollo_params.person_locations,
          q_keywords: chosen.apollo_params.q_keywords,
          page: p,
          per_page: perPage
        } as any);
        const hits = Array.isArray((resp as any)?.people) ? (resp as any).people : [];
        for (const h of hits) {
          const id = String(h?.id || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          allHits.push(h);
        }
        if (allHits.length >= Math.min(leadsPerRun * 3, 300)) break;
        if (hits.length < perPage) break;
        await wait(300);
      }

      const candidateIds = allHits.map((h: any) => h.id).filter(Boolean).slice(0, Math.min(leadsPerRun * 2, 200));
      const enriched: any[] = [];
      for (let i = 0; i < candidateIds.length; i += 10) {
        const batch = candidateIds.slice(i, i + 10);
        try {
          const r = await enrichBatch(apiKey, batch);
          enriched.push(...(r || []));
        } catch {}
        await wait(600);
      }

      const enrichedMap = new Map(enriched.map((r: any) => [String(r.id), r]));
      const finalLeads = allHits
        .map((h: any) => {
          const e = enrichedMap.get(String(h.id));
          return {
            firstName: e?.first_name || h.first_name,
            lastName: e?.last_name || h.last_name,
            title: e?.title || h.title || h.job_title,
            company: e?.organization?.name || h.organization?.name || h.company?.name,
            linkedinUrl: e?.linkedin_url || h.linkedin_url,
            email: e?.email || null,
          };
        })
        .filter((l: any) => !!l.email)
        .slice(0, leadsPerRun);

      leadsToInsert = finalLeads.map((l: any) => ({
        name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || undefined,
        title: l.title || undefined,
        company: l.company || undefined,
        linkedin_url: l.linkedinUrl || undefined,
        email: l.email || undefined
      }));
    } else {
      // If we couldn't accept results, encourage user action for next run.
      if (attempts.length >= 4) decision = 'NOTIFY_USER';
    }

    // 6) Insert into sourcing_leads and handle credits (once accepted)
    const runLogMetricsBase: any = {
      attempts_used: attempts.length || 0,
      email_coverage_pct: emailCoveragePctFinal,
      geo_match_pct: geoMatchPctFinal,
      title_match_pct: titleMatchPctFinal,
      suggested_expansion_preview: attempts.length ? (attempts[attempts.length - 1]?.judge?.recommended_adjustment?.notes || '') : '',
      recommended_fix_summary: attempts.length ? (attempts[attempts.length - 1]?.judge?.recommended_adjustment?.notes || '') : '',
      judge_reasons_good: attempts.length ? (attempts[attempts.length - 1]?.judge?.reasons_good || []) : [],
      judge_reasons_bad: attempts.length ? (attempts[attempts.length - 1]?.judge?.reasons_bad || []) : [],
      failure_reason_short: attempts.length ? String((attempts[attempts.length - 1]?.judge?.reasons_bad || [])[0] || '') : '',
      recommended_adjustment: attempts.length ? (attempts[attempts.length - 1]?.judge?.recommended_adjustment || null) : null,
    };

    // Create run log first so we can tag leads with scheduler_run_id (schedule runs only)
    let runLogId: string | null = null;
    if (scheduleId) {
      try {
        const { data: insertedLog, error: logErr } = await supabaseAdmin
          .from('schedule_run_logs')
          .insert({
            schedule_id: scheduleId,
            user_id: userId,
            persona_id: personaId,
            campaign_id: effectiveCampaignId,
            ran_at: startedAt.toISOString(),
            attempts,
            accepted_query: chosen ? chosen.apollo_params : null,
            metrics: runLogMetricsBase,
            quality_score: qualityScore,
            confidence,
            decision,
            failure_mode: failureMode,
            leads_found_count: foundCountFinal,
            leads_deduped_count: dedupedEstimateFinal,
            leads_inserted_count: 0,
            outreach_enabled: autoOutreachEnabled,
            outreach_queued_count: 0,
            notify_user: decision === 'NOTIFY_USER',
            notify_payload: {},
          })
          .select('id')
          .single();
        if (!logErr) runLogId = (insertedLog as any)?.id || null;
      } catch {}
    }

    const mirrorMetadata = scheduleId && runLogId
      ? { lead_source: `schedule:${scheduleId}`, tags: [`auto:schedule:${scheduleId}`], scheduler_run_id: runLogId }
      : scheduleId
        ? { lead_source: `schedule:${scheduleId}`, tags: [`auto:schedule:${scheduleId}`] }
        : runLogId
          ? { lead_source: `scheduler_run:${runLogId}`, tags: [`scheduler_run:${runLogId}`], scheduler_run_id: runLogId }
          : undefined;

    const addResult = leadsToInsert.length
      ? await addLeads(effectiveCampaignId!, leadsToInsert, { source: 'apollo', userId, mirrorMetadata })
      : { inserted: 0, leads: [] as any[] };

    let outreachQueued = 0;
    if (autoOutreachEnabled && effectiveCampaignId && Array.isArray((addResult as any).leads)) {
      const newLeadIds = ((addResult as any).leads as any[]).map((l: any) => l?.id).filter(Boolean);
      if (newLeadIds.length) {
        try {
          const oq = await queueInitialOutreachForNewLeads({
            campaignId: effectiveCampaignId,
            leadIds: newLeadIds,
            sendDelayMinutes,
            dailySendCap
          });
          outreachQueued = Number((oq as any)?.queued || 0);
        } catch (err: any) {
          console.warn('[sourcing.run_persona] auto-outreach queue failed', { campaignId: effectiveCampaignId, personaId, scheduleId, error: err?.message || err });
        }
      }
    }

    // Update run log with final counts and notification payload
    const notifyPayload = {
      failure_mode_label: failureModeLabel(failureMode),
      email_coverage_label: emailCoverageLabel(Number(emailCoveragePctFinal || 0)),
      outreach_mode_label: sendDelayMinutes ? 'Send after delay' : 'Send immediately when lead is created',
    };
    if (runLogId) {
      try {
        await supabaseAdmin
          .from('schedule_run_logs')
          .update({
            leads_inserted_count: Number((addResult as any)?.inserted || 0),
            outreach_queued_count: outreachQueued,
            notify_user: decision === 'NOTIFY_USER',
            notify_payload: notifyPayload,
            metrics: {
              ...runLogMetricsBase,
              found_count: foundCountFinal,
              inserted_count: Number((addResult as any)?.inserted || 0),
              deduped_count: dedupedEstimateFinal,
              email_coverage_pct: emailCoveragePctFinal,
              geo_match_pct: geoMatchPctFinal,
              title_match_pct: titleMatchPctFinal,
            }
          })
          .eq('id', runLogId);
      } catch {}
    }

    // Update schedule memory (best-effort)
    if (scheduleId) {
      try {
        const consecutiveFailures = decision === 'ACCEPT_RESULTS' ? 0 : (prevConsecutiveFailures + 1);
        await supabaseAdmin
          .from('schedules')
          .update({
            last_quality_score: qualityScore,
            last_accepted_query: chosen ? chosen.apollo_params : null,
            consecutive_failures: consecutiveFailures
          })
          .eq('id', scheduleId)
          .eq('user_id', userId);
      } catch {}
    }

    const summary = {
      run_log_id: runLogId,
      schedule_id: scheduleId,
      persona_id: personaId,
      campaign_id: effectiveCampaignId,
      attempts_used: attempts.length,
      accepted_query: chosen ? chosen.apollo_params : null,
      total_found: foundCountFinal,
      total_deduped: dedupedEstimateFinal,
      total_inserted: Number((addResult as any)?.inserted || 0),
      quality_score: qualityScore,
      confidence,
      decision,
      failure_mode: failureMode,
      notify_user: decision === 'NOTIFY_USER',
      notify_payload: notifyPayload,
      auto_send: autoOutreachEnabled,
      outreach_queued_count: outreachQueued,
      credit_mode: creditMode,
    };
    console.log(JSON.stringify({ event: 'persona_run_agentic', user_id: userId, persona_id: personaId, batch_size: leadsPerRun, ...summary, ts: new Date().toISOString() }));
    return { content: [{ type: 'text', text: JSON.stringify(summary) }] } as any;
  }
};


