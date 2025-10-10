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
      const transport = sessionId ? sseTransports.get(sessionId) : undefined;
      if (!transport) {
        res.status(400).json({ error: 'No session found', code: 'missing_session', hint: 'Include ?sessionId= from SSE endpoint or x-mcp-session header' });
        return;
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


