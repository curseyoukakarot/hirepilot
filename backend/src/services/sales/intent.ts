export type SalesIntent = 'positive' | 'neutral' | 'objection' | 'ooo' | 'unsubscribe';

export function classifyIntent(body: string): SalesIntent {
  const text = (body || '').toLowerCase();
  if (/unsubscribe|remove me|stop emailing/.test(text)) return 'unsubscribe';
  if (/out of office|ooo|vacation|away/.test(text)) return 'ooo';
  if (/(price|pricing|cost|budget)/.test(text)) return 'objection';
  if (/(yes|interested|book|schedule|let's talk|lets talk)/.test(text)) return 'positive';
  return 'neutral';
}
