import { ScheduleRow } from '../types/agentMode';

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
    case 'launch_campaign':
    case 'send_sequence':
      console.log(JSON.stringify({ event: 'execute', type: job.action_type, campaign_id: job.campaign_id, payload: job.payload }));
      return { ok: true, info: 'stub: campaign action simulated' };
    default:
      return { ok: false, error: 'unknown action_type' };
  }
}


