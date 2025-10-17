import { z } from 'zod';
import { scheduleFromPayload } from '../lib/scheduler';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const schedulerTools = [
  {
    name: 'scheduler.create_job',
    description: 'Create a scheduled job',
    parameters: z.object({
      userId: z.string(),
      name: z.string(),
      action_type: z.enum(['source_via_persona','launch_campaign','send_sequence']),
      persona_id: z.string().optional(),
      campaign_id: z.string().optional(),
      payload: z.record(z.any()).optional(),
      schedule_kind: z.enum(['one_time','recurring']),
      cron_expr: z.string().optional(),
      run_at: z.string().optional()
    }),
    handler: async (args: any) => {
      const job = await scheduleFromPayload(args.userId, args);
      return { content: [{ type: 'text', text: JSON.stringify(job) }] } as any;
    }
  },
  {
    name: 'scheduler.list_jobs',
    description: 'List scheduled jobs for a user',
    parameters: z.object({ userId: z.string() }),
    handler: async (args: any) => {
      const { data, error } = await supabaseAdmin.from('schedules').select('*').eq('user_id', args.userId).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { content: [{ type: 'text', text: JSON.stringify(data || []) }] } as any;
    }
  },
  {
    name: 'scheduler.update_job',
    description: 'Update a scheduled job',
    parameters: z.object({ userId: z.string(), id: z.string(), status: z.enum(['active','paused']).optional(), name: z.string().optional() }),
    handler: async (args: any) => {
      const { data, error } = await supabaseAdmin.from('schedules').update({ name: args.name, status: args.status }).eq('id', args.id).eq('user_id', args.userId).select('*').single();
      if (error) throw new Error(error.message);
      return { content: [{ type: 'text', text: JSON.stringify(data) }] } as any;
    }
  },
  {
    name: 'scheduler.delete_job',
    description: 'Delete a scheduled job',
    parameters: z.object({ userId: z.string(), id: z.string() }),
    handler: async (args: any) => {
      const { error } = await supabaseAdmin.from('schedules').delete().eq('id', args.id).eq('user_id', args.userId);
      if (error) throw new Error(error.message);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] } as any;
    }
  }
];


