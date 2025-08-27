import React, { useEffect, useMemo, useState } from 'react';

type InboxItem = {
  thread: { id: string; status: string; channel: string; last_inbound_at: string; last_outbound_at?: string | null; meta?: any; };
  inbound: { id: string; subject?: string|null; body?: string|null; sender?: string|null; created_at: string } | null;
  drafts: Array<{ id: string; subject?: string|null; body: string; created_at: string }>;
};

async function fetchInbox(): Promise<{ items: InboxItem[] }>{
  const r = await fetch('/api/sales/inbox', { cache: 'no-store' });
  return r.json();
}
async function sendDraft(thread_id: string, draft_id: string){
  const r = await fetch('/api/sales/inbox/send-draft', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ thread_id, draft_id })});
  return r.json();
}
async function editSend(thread_id: string, subject: string | undefined, content: string){
  const r = await fetch('/api/sales/inbox/edit-send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ thread_id, subject, content })});
  return r.json();
}
async function offerMeeting(thread_id: string, event_type?: string){
  const r = await fetch('/api/sales/inbox/offer-meeting', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ thread_id, event_type })});
  return r.json();
}
async function escalate(thread_id: string, note?: string){
  const r = await fetch('/api/sales/inbox/escalate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ thread_id, note })});
  return r.json();
}

type Policy = { assets?: { demo_video_url?: string; pricing_url?: string; one_pager_url?: string; deck_url?: string }; scheduling?: { event_type?: string } };
async function fetchPolicy(): Promise<Policy> { const r = await fetch('/api/sales/policy', { cache: 'no-store' }); return r.json(); }
async function fetchTimeline(threadId: string){ const r = await fetch(`/api/sales/thread/${threadId}/timeline`, { cache: 'no-store' }); return r.json(); }

function Chip({ disabled, title, onClick }:{ disabled?:boolean; title:string; onClick:()=>void }){
  return (
    <button disabled={disabled} title={disabled ? `Configure ${title} in Sales Agent settings` : ''} className={`rounded-full px-3 py-1 text-xs border ${disabled ? 'border-zinc-800 text-zinc-600' : 'border-zinc-700 text-zinc-200 hover:bg-zinc-800'}`} onClick={onClick} type="button">{title}</button>
  );
}

export default function ActionInboxDrawer(){
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string,string>>({});
  const [subjects, setSubjects] = useState<Record<string,string>>({});
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerThreadId, setDrawerThreadId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  async function load(){
    setLoading(true);
    const [res, pol] = await Promise.all([fetchInbox(), fetchPolicy()]);
    setItems(res.items || []);
    setPolicy(pol || {});
    setLoading(false);
  }
  useEffect(()=>{ load(); const t = setInterval(load, 20000); return ()=> clearInterval(t); }, []);

  const calendlyLink = useMemo(()=>{
    const ev = policy?.scheduling?.event_type; return ev ? `https://calendly.com/${ev}` : '';
  }, [policy]);

  async function openTimeline(threadId: string){
    setDrawerThreadId(threadId); setDrawerOpen(true); setTimelineLoading(true);
    const tl = await fetchTimeline(threadId); setTimeline(tl); setTimelineLoading(false);
  }

  if (loading) return <div className="p-4 text-sm text-zinc-400">Loading inbox…</div>;

  return (
    <>
    <div className="p-4 space-y-4">
      {items.length === 0 && <div className="text-sm text-zinc-500">No threads awaiting your approval.</div>}
      {items.map(it => (
        <div key={it.thread.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">{new Date(it.thread.last_inbound_at).toLocaleString()}</div>
            <button className="rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs" onClick={()=> openTimeline(it.thread.id)}>View timeline</button>
          </div>
          <div className="mt-2 text-sm font-semibold">Latest inbound</div>
          <pre className="text-sm whitespace-pre-wrap bg-zinc-950 border border-zinc-800 rounded p-2">{it.inbound?.body || '(no body)'}</pre>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            {(it.drafts||[]).slice(0,3).map(d => (
              <div key={d.id} className="rounded border border-zinc-800 p-2">
                <div className="text-xs text-zinc-400">{d.subject || '(no subject)'}</div>
                <pre className="text-sm whitespace-pre-wrap">{d.body}</pre>
                <button className="mt-2 rounded bg-indigo-600 hover:bg-indigo-500 px-2 py-1 text-xs" onClick={async ()=>{ const r = await sendDraft(it.thread.id, d.id); if (r?.ok) load(); }}>Send</button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <input className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm mb-2" placeholder="Subject (optional)" value={subjects[it.thread.id]||''} onChange={(e)=> setSubjects(s=> ({...s,[it.thread.id]: e.target.value}))} />
            <textarea className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-sm h-24" placeholder="Edit & send…" value={edits[it.thread.id]||''} onChange={(e)=> setEdits(s=> ({...s,[it.thread.id]: e.target.value}))} />
            <div className="mt-2 flex gap-2">
              <button className="rounded bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-xs" disabled={!edits[it.thread.id]?.trim()} onClick={async ()=>{ const r = await editSend(it.thread.id, subjects[it.thread.id], edits[it.thread.id]); if (r?.ok) { setEdits(s=> ({...s,[it.thread.id]: ''})); load(); }}}>Send edited</button>
              <button className="rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs" onClick={async ()=>{ const r = await offerMeeting(it.thread.id); if (r?.ok) load(); }}>Offer meeting</button>
              <button className="rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs" onClick={async ()=>{ const note = prompt('Escalation note (optional)')||''; const r = await escalate(it.thread.id, note); if (r?.ok) load(); }}>Escalate</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-zinc-400">Quick insert:</span>
              <Chip title="Demo" disabled={!policy?.assets?.demo_video_url} onClick={()=> setEdits(s=> ({...s,[it.thread.id]: ((s[it.thread.id]||'') + (s[it.thread.id]?'\n\n':'') + `Demo: ${policy?.assets?.demo_video_url}`)}))} />
              <Chip title="Pricing" disabled={!policy?.assets?.pricing_url} onClick={()=> setEdits(s=> ({...s,[it.thread.id]: ((s[it.thread.id]||'') + (s[it.thread.id]?'\n\n':'') + `Pricing: ${policy?.assets?.pricing_url}`)}))} />
              <Chip title="Calendly" disabled={!calendlyLink} onClick={()=> setEdits(s=> ({...s,[it.thread.id]: ((s[it.thread.id]||'') + (s[it.thread.id]?'\n\n':'') + `Grab time here: ${calendlyLink}`)}))} />
              <Chip title="One-pager" disabled={!policy?.assets?.one_pager_url} onClick={()=> setEdits(s=> ({...s,[it.thread.id]: ((s[it.thread.id]||'') + (s[it.thread.id]?'\n\n':'') + `One-pager: ${policy?.assets?.one_pager_url}`)}))} />
            </div>
          </div>
        </div>
      ))}
    </div>

    {drawerOpen && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" onClick={()=> setDrawerOpen(false)} />
        <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-zinc-800 shadow-xl p-4 overflow-auto">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Thread timeline</div>
            <button className="rounded-md px-2 py-1 hover:bg-zinc-900" onClick={()=> setDrawerOpen(false)}>Close</button>
          </div>
          <div className="mt-3">
            {timelineLoading && <div>Loading…</div>}
            {!timelineLoading && timeline && (
              <div className="space-y-6">
                {timeline.lead && (
                  <div className="rounded-xl border border-zinc-800 p-3">
                    <div className="font-semibold mb-1">Lead</div>
                    <div className="text-sm text-zinc-300">{timeline.lead.first_name} {timeline.lead.last_name} • {timeline.lead.title} @ {timeline.lead.company}</div>
                    <div className="text-xs text-zinc-500">{timeline.lead.email || ''} {timeline.lead.linkedin_url ? <>• <a className="underline" href={timeline.lead.linkedin_url} target="_blank">LinkedIn</a></> : null}</div>
                  </div>
                )}
                <div className="rounded-xl border border-zinc-800 p-3">
                  <div className="font-semibold mb-2">Messages</div>
                  <div className="space-y-3">
                    {timeline.messages.map((m:any) => (
                      <div key={m.id} className="rounded-lg border border-zinc-800 p-3 bg-zinc-900">
                        <div className="text-xs mb-1">
                          <span className={`inline-block rounded px-2 py-0.5 mr-2 ${m.direction==='inbound' ? 'bg-blue-900/40 text-blue-200' : m.direction==='outbound' ? 'bg-emerald-900/40 text-emerald-200' : 'bg-zinc-800 text-zinc-200'}`}>{m.direction}</span>
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                        {m.subject ? <div className="text-xs text-zinc-400 mb-1">{m.subject}</div> : null}
                        <pre className="whitespace-pre-wrap text-sm">{m.body || ''}</pre>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 p-3">
                  <div className="font-semibold mb-2">Actions</div>
                  {(!timeline.actions || timeline.actions.length === 0) && (<div className="text-sm text-zinc-500">No actions yet.</div>)}
                  <div className="space-y-2">
                    {timeline.actions.map((a:any) => (
                      <div key={a.id} className="text-sm text-zinc-300 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs mr-2">{a.action}</span>
                          <span className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        {a.payload?.reason ? <div className="text-xs text-zinc-500">• {a.payload.reason}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}


