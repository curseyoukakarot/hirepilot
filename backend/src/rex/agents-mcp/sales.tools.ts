import { api } from '../server';

export const salesTools = [
  {
    name: 'sales.policy_get',
    description: 'Get Sales Agent policy',
    inputSchema: { type:'object', properties:{} },
    async *invoke(){ return { content: await (api as any)('/api/sales/policy') }; }
  },
  {
    name: 'sales.policy_set',
    description: 'Set/merge Sales Agent policy JSON',
    inputSchema: { type:'object', properties:{ policy:{ type:'object' } }, required:['policy'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/policy', { method:'POST', body: JSON.stringify(a.policy) }) }; }
  },
  {
    name: 'sales.start_handling',
    description: 'Mark a thread for agent handling',
    inputSchema: { type:'object', properties:{ thread_id:{type:'string'} }, required:['thread_id'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/manual-handoff', { method:'POST', body: JSON.stringify({ thread_id: a.thread_id }) }) }; }
  },
  {
    name: 'sales.propose_reply',
    description: 'Generate N drafts for a thread (share mode)',
    inputSchema: { type:'object', properties:{ thread_id:{type:'string'}, n:{type:'number'} }, required:['thread_id'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/propose-reply', { method:'POST', body: JSON.stringify(a) }) }; }
  },
  {
    name: 'sales.send_reply',
    description: 'Send an approved reply to a thread',
    inputSchema: { type:'object', properties:{ thread_id:{type:'string'}, subject:{type:'string'}, body:{type:'string'}, assets:{type:'object'} }, required:['thread_id','body'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/send', { method:'POST', body: JSON.stringify(a) }) }; }
  },
  {
    name: 'sales.offer_meeting',
    description: 'Offer scheduling / Calendly link',
    inputSchema: { type:'object', properties:{ thread_id:{type:'string'}, event_type:{type:'string'}, window_days:{type:'number'} }, required:['thread_id'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/schedule', { method:'POST', body: JSON.stringify(a) }) }; }
  },
  {
    name: 'sales.generate_proposal',
    description: 'Generate/send proposal for DFY/enterprise',
    inputSchema: { type:'object', properties:{ thread_id:{type:'string'}, sku:{type:'string'}, terms:{type:'object'} }, required:['thread_id','sku'] },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/proposal', { method:'POST', body: JSON.stringify(a) }) }; }
  },
  {
    name: 'sales.sweep',
    description: 'Run a follow-up sweep for stuck threads',
    inputSchema: { type:'object', properties:{ lookback_hours:{type:'number'} } },
    async *invoke(a:any){ return { content: await (api as any)('/api/sales/sweep', { method:'POST', body: JSON.stringify(a) }) }; }
  }
];


