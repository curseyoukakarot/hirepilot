type Draft = { subject: string; body: string; assets?: string[] };

export async function makeDrafts(threadId: string, policy: any, intent: string): Promise<Draft[]> {
  const subject = intent === 'positive' ? 'Quick next steps' : 'Re: your note';
  const body = intent === 'positive'
    ? `Thanks for the reply — happy to share a quick overview and set up a 15-min chat. Does this week work?`
    : `Thanks for the note — can you share a bit more context so I can help best?`;
  const drafts: Draft[] = [
    { subject, body, assets: [] },
    { subject: subject + ' (alt)', body, assets: [] }
  ];
  return drafts;
}


