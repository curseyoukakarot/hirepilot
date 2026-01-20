import { ScheduleRow } from '../types/agentMode';
import { supabaseAdmin } from './supabaseAdmin';

async function executeToolAction(job: ScheduleRow) {
  const actionTool = (job.payload && job.payload.action_tool) || null;
  if (actionTool === 'sourcing.run_persona') {
    const { sourcingRunPersonaTool } = await import('../mcp/sourcing.run_persona');
    const payload = { ...(job.payload && job.payload.tool_payload ? job.payload.tool_payload : {}) } as Record<string, any>;
    const scheduleHints: Record<string, any> = {
      schedule_id: job.id,
      linked_persona_id: job.linked_persona_id ?? job.persona_id,
      linked_campaign_id: job.linked_campaign_id ?? job.campaign_id,
      auto_outreach_enabled: job.auto_outreach_enabled,
      leads_per_run: job.leads_per_run,
      send_delay_minutes: job.send_delay_minutes,
      daily_send_cap: job.daily_send_cap
    };
    Object.entries(scheduleHints).forEach(([key, value]) => {
      if (value !== undefined && payload[key] === undefined) {
        payload[key] = value;
      }
    });
    const result = await sourcingRunPersonaTool.handler({ userId: job.user_id, ...payload });
    try {
      return JSON.parse(result.content?.[0]?.text || '{}');
    } catch {
      return { ok: true } as any;
    }
  }
  if (actionTool === 'sniper.run_job') {
    const { sniperRunJobTool } = await import('../mcp/sniper.run_job');
    const payload = { ...(job.payload && job.payload.tool_payload ? job.payload.tool_payload : {}) } as Record<string, any>;
    // Pass schedule_id as hint (optional) for future audit trails
    if (payload.schedule_id === undefined) payload.schedule_id = job.id;
    const result = await sniperRunJobTool.handler({ userId: job.user_id, tool_payload: payload });
    try {
      return JSON.parse(result.content?.[0]?.text || '{}');
    } catch {
      return { ok: true } as any;
    }
  }
  return null;
}

export async function executeAction(job: ScheduleRow): Promise<{ ok: boolean; info?: string; error?: string }> {
  const toolResult = await executeToolAction(job);
  if (toolResult) {
    return { ok: true, info: 'tool executed', ...(toolResult as any) } as any;
  }
  switch (job.action_type) {
    case 'source_via_persona':
      console.log(JSON.stringify({ event: 'execute', type: 'source_via_persona', persona_id: job.persona_id, payload: job.payload }));
      return { ok: true, info: 'stub: sourced 25 leads (demo)' };
    case 'launch_campaign': {
      console.log(JSON.stringify({ event: 'execute', type: 'launch_campaign', campaign_id: job.campaign_id, payload: job.payload }));
      if (!job.campaign_id) return { ok: false, error: 'missing_campaign_id' };

      // If a Message Center sequence is provided, enroll campaign leads into it.
      const messageSequenceId = (job.payload as any)?.message_sequence_id as string | undefined;
      if (messageSequenceId) {
        try {
          const { data: leads } = await supabaseAdmin
            .from('sourcing_leads')
            .select('id')
            .eq('campaign_id', job.campaign_id);
          const leadIds = (leads || []).map((l: any) => l.id).filter(Boolean);
          if (!leadIds.length) return { ok: true, info: 'no_leads_to_enroll' };

          const { enrollLeadsInMessageSequence } = await import('../services/messageSequenceEnrollment');
          const enr = await enrollLeadsInMessageSequence({
            userId: job.user_id,
            sequenceId: messageSequenceId,
            leadIds,
            startAtUtcIso: new Date().toISOString(),
            timezone: 'America/Chicago'
          });
          return { ok: true, info: `enrolled_${(enr as any).enrolled || 0}_leads_into_sequence` };
        } catch (e: any) {
          return { ok: false, error: e?.message || 'failed_to_enroll_sequence' };
        }
      }

      // Legacy: schedule the sourcing_campaigns sequence (3-step steps_json)
      try {
        const { scheduleCampaign } = await import('../services/sourcing');
        const result = await scheduleCampaign(job.campaign_id);
        return { ok: true, info: `scheduled_campaign_${(result as any)?.scheduled || 0}_leads` };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'failed_to_schedule_campaign' };
      }
    }
    case 'send_sequence': {
      console.log(JSON.stringify({ event: 'execute', type: 'send_sequence', campaign_id: job.campaign_id, payload: job.payload }));
      const messageSequenceId = (job.payload as any)?.message_sequence_id as string | undefined;
      if (!messageSequenceId) return { ok: false, error: 'missing_message_sequence_id' };
      if (!job.campaign_id) return { ok: false, error: 'missing_campaign_id' };
      try {
        const { data: leads } = await supabaseAdmin
          .from('sourcing_leads')
          .select('id')
          .eq('campaign_id', job.campaign_id);
        const leadIds = (leads || []).map((l: any) => l.id).filter(Boolean);
        if (!leadIds.length) return { ok: true, info: 'no_leads_to_enroll' };

        const { enrollLeadsInMessageSequence } = await import('../services/messageSequenceEnrollment');
        const enr = await enrollLeadsInMessageSequence({
          userId: job.user_id,
          sequenceId: messageSequenceId,
          leadIds,
          startAtUtcIso: new Date().toISOString(),
          timezone: 'America/Chicago'
        });
        return { ok: true, info: `enrolled_${(enr as any).enrolled || 0}_leads_into_sequence` };
      } catch (e: any) {
        return { ok: false, error: e?.message || 'failed_to_enroll_sequence' };
      }
    }
    default:
      return { ok: false, error: 'unknown action_type' };
  }
}


