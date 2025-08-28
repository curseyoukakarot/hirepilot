// Lightweight agent router + state machine. Returns a structured plan for the current turn.
export type AgentMode = 'sales'|'support'|'rex';
export type AgentState = 'GREETER'|'DISCOVERY'|'QUALIFY'|'ANSWER'|'CTA'|'SUPPORT_GREETER'|'GET_CONTEXT'|'GUIDE'|'CONFIRM'|'ESCALATE';

export type SessionMeta = {
  state?: AgentState;
  last_intent?: string;
  collected?: { name?:string; email?:string; company?:string; role?:string; use_case?:string; timeline?:string };
  support_ctx?: { page?:string; jobId?:string; campaignId?:string; errorSnippet?:string };
};

export type Intent =
  | 'greeting_smalltalk'
  | 'learn_hirepilot'
  | 'pricing_plan'
  | 'comparison'
  | 'demo_booking'
  | 'lead_capture'
  | 'support_howto'
  | 'support_bug'
  | 'handoff_request'
  | 'other';

export function classifyIntent(text: string): Intent {
  const q = (text||'').toLowerCase();
  if (/\b(hi|hello|hey)\b/.test(q)) return 'greeting_smalltalk';
  if (/\bwhat\s+is\b|how\s+it\s+works|features?\b/.test(q)) return 'learn_hirepilot';
  if (/price|pricing|plan(s)?\b/.test(q)) return 'pricing_plan';
  if (/compare|vs\b|different from|sales\s*navigator|lever|bullhorn|greenhouse|workable/.test(q)) return 'comparison';
  if (/demo|walkthrough|book\b/.test(q)) return 'demo_booking';
  if (/email|name|contact\b/.test(q)) return 'lead_capture';
  if (/how\s+do\s+i|steps|guide|tutorial/.test(q)) return 'support_howto';
  if (/error|not\s*working|bug|failed/.test(q)) return 'support_bug';
  if (/human|agent|support|talk to/.test(q)) return 'handoff_request';
  return 'other';
}

export function nextState(current: AgentState|undefined, intent: Intent, mode: AgentMode): AgentState {
  if (mode === 'sales') {
    if (!current) return 'GREETER';
    if (intent === 'greeting_smalltalk') return 'DISCOVERY';
    if (intent === 'pricing_plan' || intent === 'comparison' || intent === 'learn_hirepilot') return 'ANSWER';
    if (intent === 'lead_capture' || intent === 'demo_booking') return 'CTA';
    if (intent === 'handoff_request') return 'CTA';
    return 'ANSWER';
  } else {
    if (!current) return 'SUPPORT_GREETER';
    if (intent === 'support_howto') return 'GUIDE';
    if (intent === 'support_bug') return 'GET_CONTEXT';
    if (intent === 'handoff_request') return 'ESCALATE';
    return 'GUIDE';
  }
}

export type AgentPlan = {
  intent: Intent;
  state: AgentState;
  actions: { tool: string; args: any }[];
  response: {
    say: string;
    cta: { type: 'none'|'link'|'calendly'|'lead_form'|'support_ticket'; label: string; url?: string; fields?: any[] };
  };
};

export function planTurn(input: { text: string; mode: AgentMode; meta: SessionMeta; config: { demoUrl?: string; calendlyUrl?: string } }): AgentPlan {
  const intent = classifyIntent(input.text);
  const state = nextState(input.meta.state, intent, input.mode);
  const actions: { tool:string; args:any }[] = [];
  const cta = { type: 'none' as const, label: '' };
  let say = '';

  if (input.mode === 'sales') {
    // Avoid repeating greeter once we've left GREETER state
    if (state === 'GREETER' || (intent === 'greeting_smalltalk' && (input.meta.state === undefined || input.meta.state === 'GREETER'))) {
      say = "Hey! I’m REX 👋 I can show you how HirePilot sources candidates and runs outreach. Are you hiring for clients or your own team?";
      return { intent: 'greeting_smalltalk', state:'DISCOVERY', actions, response: { say, cta: { type:'link', label:'Watch 2‑min demo', url: input.config.demoUrl || 'https://thehirepilot.com/' } } };
    }
    if (intent === 'pricing_plan') {
      actions.push({ tool:'pricing.get', args:{} });
      say = 'Here’s a quick overview of plans. Want me to send pricing details or book time to walk through setup?';
      const preferLead = !(input.meta.collected && input.meta.collected.email);
      return { intent, state:'CTA', actions, response: { say, cta: preferLead ? { type:'lead_form', label:'Share your details' } : { type:'calendly', label:'Book 15‑min', url: input.config.calendlyUrl || '' } } };
    }
    if (intent === 'comparison') {
      actions.push({ tool:'kb.search', args:{ query: input.text, k: 6 } });
      say = 'Here’s how we differ, in brief. Want to see it live on your roles?';
      return { intent, state:'ANSWER', actions, response: { say, cta: { type:'lead_form', label:'Get a tailored walkthrough', fields:[{name:'full_name',label:'Full name',type:'text',required:true},{name:'work_email',label:'Work email',type:'email',required:true},{name:'company',label:'Company',type:'text',required:false}] } } };
    }
    // default sales answer path
    actions.push({ tool:'kb.search', args:{ query: input.text, k: 6 } });
    say = 'Got it — here’s the short answer. Want a quick demo next?';
    return { intent, state:'ANSWER', actions, response: { say, cta: { type:'link', label:'See 2‑min demo', url: input.config.demoUrl || '' } } };
  }

  // Support mode
  if (state === 'SUPPORT_GREETER' || (intent === 'greeting_smalltalk' && (input.meta.state === undefined || input.meta.state === 'SUPPORT_GREETER'))) {
    say = 'Hey! Need help with anything here? I can walk you through campaigns, sequences, and integrations.';
    return { intent: 'greeting_smalltalk', state:'GET_CONTEXT', actions, response: { say, cta: { type:'link', label:'Open docs', url:'https://thehirepilot.com/' } } };
  }
  if (intent === 'support_howto') {
    actions.push({ tool:'kb.search', args:{ query: input.text, k: 6 } });
    // Suggest deep link for common email sending issues
    const deepLink = /email|send|inbox|deliver/i.test(input.text) ? '/app/settings/integrations' : undefined;
    say = 'Here are the exact steps. Want me to open the page for you?';
    return { intent, state:'GUIDE', actions, response: { say, cta: deepLink ? { type:'link', label:'Open Sender settings', url: deepLink } : { type:'none', label:'' } } };
  }
  if (intent === 'support_bug') {
    say = 'Sorry about that — can you paste the exact error message or a screenshot?';
    return { intent, state:'GET_CONTEXT', actions, response: { say, cta: { type:'support_ticket', label:'Create ticket' } } };
  }
  if (intent === 'handoff_request') {
    say = 'Happy to loop in a human. I’ll share this transcript and get someone on it.';
    return { intent, state:'ESCALATE', actions:[{ tool:'handoff.create', args:{} }], response: { say, cta: { type:'support_ticket', label:'Create ticket' } } };
  }
  actions.push({ tool:'kb.search', args:{ query: input.text, k: 6 } });
  say = 'Here’s what I found that should help.';
  return { intent, state:'GUIDE', actions, response: { say, cta: { type:'none', label:'' } } };
}


