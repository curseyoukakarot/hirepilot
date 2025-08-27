import React, { useEffect, useState } from 'react';

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

export default function ActionInboxDrawer(){
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string,string>>({});
  const [subjects, setSubjects] = useState<Record<string,string>>({});

  async function load(){
    setLoading(true);
    const res = await fetchInbox();
    setItems(res.items || []);
    setLoading(false);
  }
  useEffect(()=>{ load(); const t = setInterval(load, 20000); return ()=> clearInterval(t); }, []);

  if (loading) return <div className="p-4 text-sm text-zinc-400">Loading inbox…</div>;

  return (
    <div className="p-4 space-y-4">
      {items.length === 0 && <div className="text-sm text-zinc-500">No threads awaiting your approval.</div>}
      {items.map(it => (
        <div key={it.thread.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-xs text-zinc-500">{new Date(it.thread.last_inbound_at).toLocaleString()}</div>
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
          </div>
        </div>
      ))}
    </div>
  );
}


