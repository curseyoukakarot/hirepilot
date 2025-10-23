import { Router } from 'express';
import bodyParser from 'body-parser';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { startSupportEmailThread } from '../lib/email';

export function createSupportMcpRouter(): Router {
  const supportMcpRouter = Router();

  const server = new Server({ name: 'HirePilot Support MCP', version: '1.0.0' });

  // Unified tool registry used for both SSE and HTTP JSON-RPC stubs
  const tools: Record<string, {
    description: string;
    input_schema: any;
    handler: (args: any) => Promise<any>;
  }> = {
    lookup_user: {
      description: 'Find user by email/session',
      input_schema: { type: 'object', properties: { email: { type: 'string' }, session_token: { type: 'string' } }, additionalProperties: false },
      handler: async (args: any) => {
        const { email, session_token } = args || {};
        let user: any = null;
        if (email) {
          const { data, error } = await supabaseAdmin.from('users').select('id,email,plan').eq('email', email).maybeSingle();
          if (error) throw new Error(error.message);
          user = data;
        }
        if (!user && session_token) {
          const { data, error } = await supabaseAdmin.from('sessions').select('user_id').eq('token', session_token).maybeSingle();
          if (error) throw new Error(error.message);
          if (data?.user_id) {
            const { data: u, error: uerr } = await supabaseAdmin.from('users').select('id,email,plan').eq('id', data.user_id).maybeSingle();
            if (uerr) throw new Error(uerr.message);
            user = u;
          }
        }
        return { content: [{ type: 'text', text: user ? JSON.stringify({ user_id: user.id, email: user.email, plan: user.plan }) : JSON.stringify({ not_found: true }) }] } as any;
      }
    },
    fetch_plan: {
      description: 'Return plan info',
      input_schema: { type: 'object', properties: { user_id: { type: 'string' } }, required: ['user_id'] },
      handler: async () => ({ content: [{ type: 'text', text: JSON.stringify({ plan: 'pro', seats: 5, credits: 12000, renews_on: '2026-01-01' }) }] } as any)
    },
    check_service_health: {
      description: 'Service health',
      input_schema: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] },
      handler: async () => ({ content: [{ type: 'text', text: JSON.stringify({ status: 'ok' }) }] } as any)
    },
    notify_email_thread: {
      description: 'Send support email',
      input_schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] },
      handler: async (args: any) => {
        const { to, subject, body } = args || {};
        const result = await startSupportEmailThread({ to, subject, body });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] } as any;
      }
    },
    create_ticket: {
      description: 'Create support ticket',
      input_schema: { type: 'object', properties: { user_id: { type: 'string' }, issue_kind: { type: 'string' }, summary: { type: 'string' } }, required: ['user_id', 'issue_kind', 'summary'] },
      handler: async (args: any) => {
        const { user_id, issue_kind, summary } = args || {};
        const { data, error } = await supabaseAdmin.from('support_tickets').insert({ user_id, issue_kind, summary }).select('id').single();
        if (error) throw new Error(error.message);
        return { content: [{ type: 'text', text: JSON.stringify({ ticket_id: data.id }) }] } as any;
      }
    },
    // ---------------- REX Tools (HTTP surface) ----------------
    'opportunity.submitToClient': {
      description: 'Submit candidate to client for an opportunity',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, opportunityId: { type: 'string' }, candidateId: { type: 'string' }, message: { type: 'string' } }, required: ['user_token','opportunityId','candidateId'] },
      handler: async ({ user_token, opportunityId, candidateId, message }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/opportunity/submit-to-client`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ opportunityId, candidateId, message }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'opportunity.addNote': {
      description: 'Add note to an opportunity',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, opportunityId: { type: 'string' }, text: { type: 'string' } }, required: ['user_token','opportunityId','text'] },
      handler: async ({ user_token, opportunityId, text }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/opportunity/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ opportunityId, text }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'opportunity.addCollaborator': {
      description: 'Add a collaborator to an opportunity',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, opportunityId: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } }, required: ['user_token','opportunityId','email'] },
      handler: async ({ user_token, opportunityId, email, role }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/opportunity/collaborators`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ opportunityId, email, role }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'messaging.bulkSchedule': {
      description: 'Bulk schedule messages from a template',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, template_id: { type: 'string' }, lead_ids: { type: 'array', items: { type: 'string' } }, scheduled_at: { type: 'string' }, sender: { type: 'object' } }, required: ['user_token','template_id','lead_ids','scheduled_at','sender'] },
      handler: async (args: any) => {
        const { user_token, ...payload } = args || {};
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/messaging/bulk-schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'messaging.scheduleMassMessage': {
      description: 'Schedule arbitrary message batch',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, messages: { type: 'array', items: { type: 'object' } } }, required: ['user_token','messages'] },
      handler: async (args: any) => {
        const { user_token, ...payload } = args || {};
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/messaging/schedule-mass`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'sourcing.relaunch': {
      description: 'Relaunch a sourcing campaign',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, campaignId: { type: 'string' } }, required: ['user_token','campaignId'] },
      handler: async ({ user_token, campaignId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/sourcing/relaunch`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ campaignId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'sourcing.schedule': {
      description: 'Schedule a sourcing campaign',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, campaignId: { type: 'string' } }, required: ['user_token','campaignId'] },
      handler: async ({ user_token, campaignId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/sourcing/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ campaignId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'sourcing.stats': {
      description: 'Get campaign stats (optionally emit snapshot)',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, campaignId: { type: 'string' }, emit: { type: 'boolean' } }, required: ['user_token','campaignId'] },
      handler: async ({ user_token, campaignId, emit }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/sourcing/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ campaignId, emit: !!emit }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'enrichment.lead': {
      description: 'Enrich a lead',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, leadId: { type: 'string' } }, required: ['user_token','leadId'] },
      handler: async ({ user_token, leadId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/enrichment/lead`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ leadId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'enrichment.candidate': {
      description: 'Enrich a candidate',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, candidateId: { type: 'string' } }, required: ['user_token','candidateId'] },
      handler: async ({ user_token, candidateId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/enrichment/candidate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ candidateId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'crm.clientCreate': {
      description: 'Create a client',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, name: { type: 'string' }, domain: { type: 'string' } }, required: ['user_token','name'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/crm/client`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'crm.clientUpdate': {
      description: 'Update a client',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, id: { type: 'string' }, update: { type: 'object' } }, required: ['user_token','id','update'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/crm/client/update`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'crm.clientEnrich': {
      description: 'Enrich a client record',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, id: { type: 'string' } }, required: ['user_token','id'] },
      handler: async ({ user_token, id }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/crm/client/enrich`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ id }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'crm.contactCreate': {
      description: 'Create a client contact',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, client_id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' }, title: { type: 'string' } }, required: ['user_token','client_id','email'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/crm/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'billing.purchaseCredits': {
      description: 'Purchase credits',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, packageId: { type: 'string' } }, required: ['user_token','packageId'] },
      handler: async ({ user_token, packageId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/billing/credits/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ packageId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'billing.checkout': {
      description: 'Start a subscription checkout session',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' } }, required: ['user_token'] },
      handler: async ({ user_token }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/billing/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${user_token}` } } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'billing.cancel': {
      description: 'Cancel subscription',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' } }, required: ['user_token'] },
      handler: async ({ user_token }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/billing/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${user_token}` } } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'billing.invoiceCreate': {
      description: 'Create an invoice',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, client_id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, description: { type: 'string' }, opportunity_id: { type: 'string' }, billing_type: { type: 'string' }, recipient_email: { type: 'string' }, notes: { type: 'string' } }, required: ['user_token','client_id','amount'] },
      handler: async (args: any) => {
        const { user_token, ...payload } = args || {};
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/billing/invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'team.invite': {
      description: 'Invite a team member',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } }, required: ['user_token','email'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/team/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'team.updateRole': {
      description: 'Update team member role',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, memberId: { type: 'string' }, role: { type: 'string' } }, required: ['user_token','memberId','role'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/team/role`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'notifications.create': {
      description: 'Create a user notification',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, type: { type: 'string' } }, required: ['user_token'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/notifications/create`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'sniper.addTarget': {
      description: 'Add a sniper capture target',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, url: { type: 'string' }, opener: { type: 'boolean' } }, required: ['user_token','url'] },
      handler: async ({ user_token, ...payload }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/sniper/targets`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify(payload) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'sniper.captureNow': {
      description: 'Trigger an immediate capture for a target',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, targetId: { type: 'string' } }, required: ['user_token','targetId'] },
      handler: async ({ user_token, targetId }: any) => {
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        const resp = await fetch(`${base}/api/rex/tools/sniper/capture-now`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ targetId }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    },
    'linkedin.connect': {
      description: 'Queue LinkedIn connection requests',
      input_schema: { type: 'object', properties: { user_token: { type: 'string' }, linkedin_urls: { type: 'array', items: { type: 'string' } }, message: { type: 'string' }, scheduled_at: { type: 'string' } }, required: ['user_token','linkedin_urls'] },
      handler: async (args: any) => {
        const { user_token, ...payload } = args || {};
        const base = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '';
        // Use the generic rex tools entry point (existing)
        const resp = await fetch(`${base}/api/rex/tools`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user_token}` }, body: JSON.stringify({ tool: 'linkedin_connect', args: payload }) } as any);
        const body = await resp.json().catch(()=>({}));
        return { content: [{ type: 'text', text: JSON.stringify({ status: resp.status, body }) }] } as any;
      }
    }
  };

  // Register capabilities for SSE transport
  server.registerCapabilities({
    tools: Object.fromEntries(Object.entries(tools).map(([name, def]) => [name, {
      description: def.description,
      parameters: def.input_schema,
      handler: def.handler
    }])) as any
  });

  // Maintain active SSE transports by session
  const sseTransports = new Map<string, SSEServerTransport>();

  // Minimal JSON-RPC stub for POST /: accept 'initialize' to satisfy clients that probe the base path
  supportMcpRouter.post('/', bodyParser.json({ type: 'application/json' }), async (req, res) => {
    try {
      const body = (req as any).body || {};
      const { jsonrpc = '2.0', id = null, method = '' } = body;
      if (method === 'initialize') {
        return res.json({
          jsonrpc,
          id,
          result: {
            capabilities: {},
            serverInfo: { name: 'HirePilot Support MCP', version: '1.0.0' }
          }
        });
      }
      if (method === 'tools/list') {
        const toolList = Object.entries(tools).map(([name, def]) => ({ name, description: def.description, input_schema: def.input_schema }));
        return res.json({ jsonrpc, id, result: { tools: toolList } });
      }
      if (method === 'tools/call') {
        const { name, arguments: args } = body?.params || {};
        if (!name || !(name in tools)) {
          return res.json({ jsonrpc, id, error: { code: -32601, message: 'Unknown tool' } });
        }
        try {
          const result = await tools[name].handler(args);
          return res.json({ jsonrpc, id, result });
        } catch (e: any) {
          return res.json({ jsonrpc, id, error: { code: -32000, message: e?.message || 'tool failed' } });
        }
      }
      // For any other base-path calls, no-op to avoid handshake failures
      return res.status(204).end();
    } catch (err) {
      console.error('[MCP HTTP initialize] error:', err);
      // Return a JSON-RPC error envelope but keep HTTP 200 to avoid 424 classification
      return res.json({ jsonrpc: '2.0', id: (req as any)?.body?.id ?? null, error: { code: -32603, message: 'initialize failed' } });
    }
  });

  // Per-connection GET handler: create transport with live response stream
  supportMcpRouter.get('/', (req, res) => {
    try {
      // Emit absolute messages path so clients do not mis-resolve the endpoint
      const transport = new SSEServerTransport('/agent-tools/support/mcp/messages', res as any);
      // @ts-ignore - sessionId provided by transport implementation
      const sessionId: string = (transport as any).sessionId || Math.random().toString(36).slice(2);
      sseTransports.set(sessionId, transport);

      res.on('close', () => {
        sseTransports.delete(sessionId);
      });

      // Start the SSE transport (this writes headers); do not write to res before connect()
      server.connect(transport);
    } catch (err) {
      console.error('[MCP SSE] setup error:', err);
      try { res.status(500).send('SSE setup failed'); } catch {}
    }
  });

  // POST handler for bidirectional messages from client
  supportMcpRouter.post('/messages', async (req, res) => {
    try {
      const sessionId = (req.query.sessionId as string) || (req.headers['x-mcp-session'] as string) || (typeof (req as any).body === 'string' ? '' : (req as any).body?.sessionId) || '';
      console.log('[MCP POST] url=', req.url, 'ct=', req.headers['content-type'], 'len=', req.headers['content-length'], 'session=', sessionId || 'missing');
      let transport = sessionId ? sseTransports.get(sessionId) : undefined;
      if (!transport) {
        // Fallback: use the most recent/only transport if available
        const iter = sseTransports.values();
        const first = iter.next().value as SSEServerTransport | undefined;
        if (first) {
          transport = first;
        } else {
          res.status(400).json({ error: 'No session found', code: 'missing_session', hint: 'Include ?sessionId= from SSE endpoint or x-mcp-session header' });
          return;
        }
      }
      // Some SDK versions expose a handlePostMessage helper
      if (typeof (transport as any).handlePostMessage === 'function') {
        await (transport as any).handlePostMessage(req, res);
        return;
      }
      // Fallback: let transport router/process handle this if available
      if ((transport as any).router) {
        try {
          // Delegate to internal router; mount a one-off handler if needed
          return (transport as any).router(req, res);
        } catch {}
      }
      res.status(501).json({ error: 'handlePostMessage not supported' });
    } catch (err) {
      console.error('[MCP SSE] post message error:', err);
      res.status(500).json({ error: 'message handling failed', detail: (err as any)?.message || String(err) });
    }
  });

  return supportMcpRouter;
}


