import { createSupportTicketClient, searchSupportKnowledge } from '../../lib/support';

export const supportAgent = {
  name: 'SupportAgent',
  description: 'Provides HirePilot product help, guides, and issue reporting',
  // Document expected I/O without requiring zod at runtime
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' }, userId: { type: 'string', optional: true } },
  } as const,
  outputSchema: {
    type: 'object',
    properties: {
      response: { type: 'string' },
      escalation: { enum: ['rex_chat', 'slack_rex', 'support_ticket', 'none'] },
    },
  } as const,
  async execute({ query, userId }: { query: string; userId?: string }) {
    // 1) Block explicit action execution requests
    if (/(move|execute|send|launch|create|delete|update|do this)/i.test(query)) {
      return {
        response:
          "I can’t run that action directly. You can do this inside REX chat in HirePilot or ask REX in Slack.",
        escalation: 'rex_chat' as const,
      };
    }

    // 2) Detect issue/bug reports and create a support ticket
    if (/(bug|error|not working|issue|broken|fails|crash|can't|cannot)/i.test(query)) {
      try {
        const ticket = await createSupportTicketClient(query, userId || null);
        return {
          response: `I’ve logged this issue for the HirePilot team. Ticket ID: ${ticket.id}`,
          escalation: 'support_ticket' as const,
        };
      } catch (e: any) {
        return {
          response: `I tried to log a ticket but hit an error: ${e?.message || 'unknown error'}. Please try again or email support@thehirepilot.com`,
          escalation: 'none' as const,
        };
      }
    }

    // 3) Retrieval-augmented explanation from knowledge base
    try {
      const hits = await searchSupportKnowledge(query, 5);
      if (Array.isArray(hits) && hits.length > 0) {
        const top = hits.slice(0, 3).map((h, i) => `• ${h.title || h.type}: ${String(h.content || '').slice(0, 240)}${(h.content || '').length > 240 ? '…' : ''}`).join('\n');
        const restrictedNote = hits.some(h => h.restricted) ? '\n\nNote: Some features are restricted to explanations only here. Use REX chat to execute.' : '';
        return { response: `${top}${restrictedNote}`, escalation: 'none' as const };
      }
    } catch {}

    // Fallback if nothing found
    return { response: "I don’t have that answer yet. You can ask REX directly in chat or Slack.", escalation: 'none' as const };
  },
};

export type SupportAgent = typeof supportAgent;


