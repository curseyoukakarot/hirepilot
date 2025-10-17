import { ScheduleRow } from '../types/agentMode';

export async function executeAction(job: ScheduleRow): Promise<{ ok: boolean; info?: string; error?: string }> {
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


