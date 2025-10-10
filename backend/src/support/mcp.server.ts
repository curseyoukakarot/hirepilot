import { Router } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { startSupportEmailThread } from '../lib/email';

export function createSupportMcpRouter(): Router {
  const router = Router();

  const server = new Server({ name: 'HirePilot Support MCP', version: '1.0.0' });

  server.registerCapabilities({
    tools: {
      lookup_user: {
        description: 'Find user by email/session',
        parameters: { type: 'object', properties: { email: { type: 'string' }, session_token: { type: 'string' } }, additionalProperties: false },
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
        parameters: { type: 'object', properties: { user_id: { type: 'string' } }, required: ['user_id'] },
        handler: async () => ({ content: [{ type: 'text', text: JSON.stringify({ plan: 'pro', seats: 5, credits: 12000, renews_on: '2026-01-01' }) }] } as any)
      },
      check_service_health: {
        description: 'Service health',
        parameters: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] },
        handler: async () => ({ content: [{ type: 'text', text: JSON.stringify({ status: 'ok' }) }] } as any)
      },
      notify_email_thread: {
        description: 'Send support email',
        parameters: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] },
        handler: async (args: any) => {
          const { to, subject, body } = args || {};
          const result = await startSupportEmailThread({ to, subject, body });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] } as any;
        }
      },
      create_ticket: {
        description: 'Create support ticket',
        parameters: { type: 'object', properties: { user_id: { type: 'string' }, issue_kind: { type: 'string' }, summary: { type: 'string' } }, required: ['user_id', 'issue_kind', 'summary'] },
        handler: async (args: any) => {
          const { user_id, issue_kind, summary } = args || {};
          const { data, error } = await supabaseAdmin.from('support_tickets').insert({ user_id, issue_kind, summary }).select('id').single();
          if (error) throw new Error(error.message);
          return { content: [{ type: 'text', text: JSON.stringify({ ticket_id: data.id }) }] } as any;
        }
      }
    }
  });

  // Mount SSE transport at the router root; transport attaches handlers to the provided router
  const transport = new SSEServerTransport('/', router as any);

  server.connect(transport);

  return router;
}


