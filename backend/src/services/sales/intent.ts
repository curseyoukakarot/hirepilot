export type Intent = 'positive'|'neutral'|'objection'|'ooo'|'unsubscribe';

export function classifyIntent(text: string): Intent {
  const t = (text || '').toLowerCase();
  if (/unsubscribe|remove me|stop emailing/.test(t)) return 'unsubscribe';
  if (/out of office|ooo|away until/.test(t)) return 'ooo';
  if (/not interested|no thanks|pass|too expensive|pricing/.test(t)) return 'objection';
  if (/interested|sounds good|let's talk|book|schedule|demo/.test(t)) return 'positive';
  return 'neutral';
}
