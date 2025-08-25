import { SniperParams } from './schemas';

export const SNIPER_EXTRACT = `
You convert a user instruction into JSON for the Sniper Agent.
Return ONLY JSON:
{ "agent_key":"sniper", "params": { "type":"own|competitor|keyword", "post_url?":"", "keyword_match?":"", "daily_cap?":15, "active_days?":7, "send_opener?":false } }
If missing required fields, set defaults and leave the rest empty.
`;

// Minimal wrappers that mimic orchestrator helpers
async function jsonExtract(prompt: string, text: string): Promise<any> {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [ { role:'system', content: prompt }, { role:'user', content: text } ],
    temperature: 0
  });
  try {
    const content = resp.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch {
    return { agent_key: 'sniper', params: {} };
  }
}

function ask(message: string): string { return message; }
function wizardCard(card: any): any { return card; }
function done(message: string): string { return message; }

export async function startSniperWizard(text:string, tools:any, user:{id:string}) {
  const plan = await jsonExtract(SNIPER_EXTRACT, text);
  if (plan.agent_key !== 'sniper') return ask('Do you want to start a Sniper target? Provide a post URL or a keyword.');
  const parsed = SniperParams.safeParse(plan.params || {});
  if (!parsed.success) {
    const miss = parsed.error.issues.map(i=>i.path.join('.'));
    return ask(`I need: ${miss.join(', ')}`);
  }

  // Check LinkedIn session
  const resp = await fetch(`${process.env.BACKEND_BASE_URL}/api/integrations/linkedin/session`, { headers:{ 'x-user-id': user.id } });
  const sess = await resp.json().catch(() => ({ hasSession:false }));
  if (!sess.hasSession) return wizardCard({
    title: "Connect LinkedIn",
    body_md: "To run Sniper, connect your LinkedIn session (LI_AT + cookie) in Settings or via the Chrome helper.",
    actions: [{ id: "open_settings", type:"button", label:"Open Settings" }]
  });

  const t = await tools.call('sniper_add_target', { userId: user.id, ...parsed.data });
  return done(`Sniper started: ${parsed.data.type === 'keyword' ? parsed.data.keyword_match : parsed.data.post_url}. I'll capture up to ${parsed.data.daily_cap}/day and drop them into a Sniper micro-campaign.`);
}


