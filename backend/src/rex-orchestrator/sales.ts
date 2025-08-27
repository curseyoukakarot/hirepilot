import { z } from 'zod';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const SALES_EXTRACT = `
Extract user intent for the Sales Agent. Return JSON:
{"mode":"share|handle","tone":"", "event_type":"", "sender_email":"", "actions":["propose|handle|offer_meeting|send_assets|generate_proposal"], "thread_id":""}
Include only keys present in the user request, else omit.
`;

const PlanSchema = z.object({
  mode: z.enum(['share','handle']).optional(),
  tone: z.string().optional(),
  event_type: z.string().optional(),
  sender_email: z.string().email().optional(),
  actions: z.array(z.enum(['propose','handle','offer_meeting','send_assets','generate_proposal'])).optional(),
  thread_id: z.string().optional()
});

async function jsonExtract(prompt: string, text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text }
      ],
      temperature: 0
    });
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const safe = PlanSchema.safeParse(parsed);
    return safe.success ? safe.data : {};
  } catch (e) {
    return {};
  }
}

export async function salesOrchestrate(text: string, tools: any){
  const plan = await jsonExtract(SALES_EXTRACT, text);

  const patch: any = {};
  if (plan.mode) patch.mode = plan.mode;
  if (plan.tone) patch.reply_style = { tone: plan.tone };
  if (plan.event_type) patch.scheduling = { event_type: plan.event_type };
  if (plan.sender_email) patch.sender = { behavior: 'single', email: plan.sender_email };

  if (Object.keys(patch).length) {
    await tools.call('sales.policy_set', { policy: patch });
  }

  if (plan.thread_id) {
    const actions: string[] = plan.actions || [];
    if (actions.includes('propose')) await tools.call('sales.propose_reply', { thread_id: plan.thread_id, n: 3 });
    if (actions.includes('handle')) await tools.call('sales.start_handling', { thread_id: plan.thread_id });
    if (actions.includes('offer_meeting')) await tools.call('sales.offer_meeting', { thread_id: plan.thread_id, event_type: plan.event_type });
    // send_assets / generate_proposal could be added here similarly
  }

  return { ok: true, plan };
}


