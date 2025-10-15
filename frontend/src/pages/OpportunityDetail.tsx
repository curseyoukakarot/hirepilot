import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Local components (same file for now; can be split later into /components/*)
function Card({ children, className = '' }: any) {
  return <div className={`bg-white rounded-xl shadow-sm border p-6 ${className}`}>{children}</div>;
}
function SectionTitle({ children, right }: any) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold">{children}</h3>
      {right}
    </div>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opp, setOpp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [newActType, setNewActType] = useState<'call'|'email'|'meeting'|'note'|'task'|'update'>('note');
  const [collabs, setCollabs] = useState<any[]>([]);
  const [newCollab, setNewCollab] = useState('');
  const [newReqId, setNewReqId] = useState('');
  const [availableReqs, setAvailableReqs] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [submitOpen, setSubmitOpen] = useState<{ open: boolean; data: any|null }>({ open: false, data: null });
  const [signature, setSignature] = useState('');
  const [detailOpen, setDetailOpen] = useState<any|null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : null;
      setOpp(js);
      setNotes(js?.notes || '');
      // load activity via unified deals activity
      try {
        const actRes = await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/deals/activity?entityType=opportunity&entityId=${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = actRes.ok ? await actRes.json() : { rows: [] };
        setActivity(js.rows || []);
      } catch {}
      try {
        const cRes = await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}/collaborators`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setCollabs(cRes.ok ? await cRes.json() : []);
      } catch {}
      try {
        const rRes = await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}/available-reqs`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setAvailableReqs(rRes.ok ? await rRes.json() : []);
      } catch {}
      try {
        const uRes = await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}/available-users`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        setAvailableUsers(uRes.ok ? await uRes.json() : []);
      } catch {}
      setLoading(false);
    };
    run();
  }, [id]);

  const saveNotes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ notes })
    });
  };

  const addActivity = async () => {
    if (!newActivity.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const payload = {
      links: [{ entityType: 'opportunity', entityId: String(id) }],
      type: newActType,
      title: undefined,
      body: newActivity.trim(),
      occurredAt: new Date().toISOString()
    };
    const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/deals/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      // refresh
      const actRes = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/deals/activity?entityType=opportunity&entityId=${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = actRes.ok ? await actRes.json() : { rows: [] };
      setActivity(js.rows || []);
      setNewActivity('');
    }
  };

  const addCollaborator = async () => {
    if (!newCollab.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/opportunities/${id}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ email: newCollab.trim() })
    });
    if (resp.ok) {
      const row = await resp.json();
      setCollabs((c:any[]) => [row, ...c]);
      setNewCollab('');
    }
  };

  const attachReq = async () => {
    const idStr = newReqId.trim();
    if (!idStr) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const reqIds = Array.from(new Set([...(opp?.req_ids || []), idStr]));
    const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ req_ids: reqIds })
    });
    if (resp.ok) {
      setOpp((o:any) => ({ ...o, req_ids: reqIds }));
      setNewReqId('');
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!opp) return <div className="p-6">Not found</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{opp.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Client: {opp.client?.name || opp.client?.domain || opp.client_id?.slice(0,8)}</span>
              <span>Owner: {opp.owner?.name || opp.owner?.email || opp.owner_id?.slice(0,8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">{opp.stage || 'Open'}</span>
            <select className="border rounded px-2 py-1 text-sm" value={opp.stage || 'Pipeline'} onChange={async e=>{
              const newStage = e.target.value;
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              await fetch(`${(import.meta as any).env.VITE_BACKEND_URL}/api/opportunities/${id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ stage: newStage }) });
              setOpp((o:any)=>({ ...o, stage: newStage }));
            }}>
              {['Pipeline','Best Case','Commit','Close Won','Closed Lost'].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Stage</div><div className="text-sm font-semibold">{opp.stage || '—'}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Value</div><div className="text-sm font-semibold">{(Number(opp.value)||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Created</div><div className="text-sm font-semibold">{opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '—'}</div></div>
          <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">Billing</div><div className="text-sm font-semibold">{opp.billing_type || '—'}</div></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <SectionTitle>Description</SectionTitle>
            <textarea className="w-full p-3 border rounded-lg resize-none" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} />
            <div className="mt-3 text-right"><button className="px-3 py-1.5 bg-gray-900 text-white rounded" onClick={saveNotes}>Save</button></div>
          </Card>

          <Card>
            <SectionTitle right={<div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={newReqId} onChange={e=>setNewReqId(e.target.value)}>
                  <option value="">Select job req…</option>
                  {availableReqs.map((r:any)=> (<option key={r.id} value={r.id}>{r.title}</option>))}
                </select>
                <button className="text-sm text-blue-600" onClick={attachReq}>Attach REQ</button>
              </div>}>
              Linked Job Reqs
            </SectionTitle>
            <div className="text-sm text-gray-600">{(opp.req_ids||[]).length ? (opp.req_ids||[]).join(', ') : 'No linked REQs'}</div>
          </Card>

          {/* Candidate Cards (Applications + Submissions) */}
          <Card>
            <h3 className="text-lg font-semibold mb-3">Candidates</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">Applications + Submissions</div>
          <button className="px-3 py-1.5 text-sm border rounded" onClick={async ()=>{
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/opportunities/${id}/backfill-submissions`, { method:'POST', headers: { 'Content-Type':'application/json', ...(token?{ Authorization:`Bearer ${token}` }:{}) } });
            if (resp.ok) {
              const js = await resp.json();
              try { (await import('react-hot-toast')).toast.success(`Backfill created ${js.created||0}`); } catch {}
              // refresh opportunity
              const r = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/opportunities/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
              const j = r.ok ? await r.json() : null; setOpp(j);
            } else {
              try { (await import('react-hot-toast')).toast.error('Backfill failed'); } catch {}
            }
          }}>Backfill recent submissions</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
              {(opp?.applications||[]).map((c:any) => (
                <div key={`app-${c.id}`} className="border rounded-lg p-3">
                  <div className="font-semibold text-gray-900">{c.full_name || c.email}</div>
                  <div className="text-sm text-gray-600">{c.email}</div>
                  {c.linkedin_url && <div className="text-sm text-blue-600 truncate"><a href={c.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a></div>}
                  {c.resume_url && <div className="text-sm text-blue-600 truncate"><a href={c.resume_url} target="_blank" rel="noreferrer">Resume</a></div>}
                  <div className="mt-2 text-xs text-gray-500 line-clamp-3">{c.cover_note || ''}</div>
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-1.5 text-sm border rounded" onClick={()=>setDetailOpen({ type:'application', ...c })}>View Details</button>
                    <button className="px-3 py-1.5 text-sm border rounded" onClick={()=>setSubmitOpen({ open:true, data: { type:'application', ...c } })}>Submit to Client</button>
                  </div>
                </div>
              ))}
              {(opp?.submissions||[]).map((c:any) => (
                <div key={`sub-${c.id}`} className="border rounded-lg p-3">
                  <div className="font-semibold text-gray-900">{[c.first_name,c.last_name].filter(Boolean).join(' ') || c.email}</div>
                  <div className="text-sm text-gray-600">{c.email}</div>
                  {c.linkedin_url && <div className="text-sm text-blue-600 truncate"><a href={c.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a></div>}
                  {c.resume_url && <div className="text-sm text-blue-600 truncate"><a href={c.resume_url} target="_blank" rel="noreferrer">Resume</a></div>}
                  <div className="mt-2 text-xs text-gray-500 line-clamp-3">{c.notable_impact || ''}</div>
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-1.5 text-sm border rounded" onClick={()=>setDetailOpen({ type:'submission', ...c })}>View Details</button>
                    <button className="px-3 py-1.5 text-sm border rounded" onClick={()=>setSubmitOpen({ open:true, data: { type:'submission', ...c } })}>Submit to Client</button>
                  </div>
                </div>
              ))}
            </div>
            {(!((opp?.applications||[]).length || (opp?.submissions||[]).length)) && (
              <div className="text-sm text-gray-500">No candidates yet</div>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-semibold mb-3">Activity Log</h3>
            <div className="space-y-3 mb-3">
              {activity.map((a:any)=> (
                <div key={a.id} className="bg-gray-50 rounded p-2 text-sm text-gray-800">
                  <div className="font-medium text-gray-900 capitalize">{a.type || 'note'}</div>
                  <div>{a.body || a.title || ''}</div>
                  <div className="text-xs text-gray-400">{a.occurred_at ? new Date(a.occurred_at).toLocaleString() : ''}</div>
                </div>
              ))}
              {activity.length===0 && <div className="text-sm text-gray-500">No activity yet</div>}
            </div>
            <div className="flex gap-2 items-center">
              <select className="border rounded px-2 py-2 text-sm" value={newActType} onChange={e=>setNewActType(e.target.value as any)}>
                {['call','email','meeting','note','task','update'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add activity details…" value={newActivity} onChange={e=>setNewActivity(e.target.value)} />
              <button className="px-3 py-2 bg-gray-900 text-white rounded" onClick={addActivity}>Log</button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Assigned Team</h3>
              <div className="flex items-center gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={newCollab} onChange={e=>setNewCollab(e.target.value)}>
                  <option value="">Select teammate…</option>
                  {availableUsers.map((u:any)=> (<option key={u.id} value={u.email}>{u.name}</option>))}
                </select>
                <button className="text-sm text-blue-600" onClick={addCollaborator}>Add</button>
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">Owner: {opp.owner?.name || opp.owner?.email || opp.owner_id?.slice(0,8)}</div>
            <div className="space-y-1 text-sm">
              {collabs.map((c:any)=> (<div key={c.id} className="text-gray-800">{c.email} <span className="text-gray-400">({c.role||'collaborator'})</span></div>))}
              {collabs.length===0 && <div className="text-gray-500">No collaborators yet</div>}
            </div>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold mb-3">Internal Notes</h3>
            <div className="text-sm text-gray-600">Add comments & tag teammates (TBD).</div>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold mb-3">REX Insights</h3>
            <div className="text-sm text-gray-600">Guidance coming from REX.</div>
          </Card>
        </div>
      </div>
      {/* Submit to Client Modal */}
      {submitOpen.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 mt-10 mb-10">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Submit to Client</h3><button className="text-gray-500" onClick={()=>setSubmitOpen({ open:false, data:null })}>✕</button></div>
            <SubmitForm data={submitOpen.data} clientId={opp.client?.id || opp.client_id} opportunityId={String(id)} signature={signature} setSignature={setSignature} onClose={()=>setSubmitOpen({ open:false, data:null })} />
          </div>
        </div>
      )}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 mt-10 mb-10">
            <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">Candidate Details</h3><button className="text-gray-500" onClick={()=>setDetailOpen(null)}>✕</button></div>
            <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(detailOpen, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitForm({ data, opportunityId, clientId, signature, setSignature, onClose }: any) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Candidate for your review');
  const [body, setBody] = useState('');
  const [provider, setProvider] = useState<'google'|'outlook'|'sendgrid'>('google');
  useEffect(() => {
    // Prefill with primary contact from client
    const run = async () => {
      if (!clientId) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
    const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/clients/contacts/all`, { headers: token?{ Authorization:`Bearer ${token}` }:{} });
        const list = resp.ok ? await resp.json() : [];
        const contacts = (list||[]).filter((c:any)=>String(c.client_id||'')===String(clientId));
        const primary = contacts.find((c:any)=>c.email) || contacts[0];
        if (primary?.email) setTo(primary.email);
      } catch {}
    };
    run();
  }, [clientId]);
  useEffect(() => {
    if (!data) return;
    const name = data.type==='submission' ? [data.first_name, data.last_name].filter(Boolean).join(' ') : (data.full_name || '');
    const email = data.email || '';
    const location = data.location || '';
    const profile = data.linkedin_url || '';
    const years = data.years_experience || '';
    const resume = data.resume_url || '';
    const impact = data.notable_impact || data.cover_note || '';
    const motivation = data.motivation || '';
    const defaultText = `Hi Mark,\n\nSee the attached candidate for your review! If thumbs up we'd like to schedule a phone or a zoom screen with you:\n\nName: ${name}\nPosition: ${data.title || ''}\nLocation: ${location}\nEmail: ${email}\nProfile Link: ${profile}\nYears of Experience: ${years}\n\nNotable Impact:\n${impact}\n\nMotivation:\n${motivation}\n\nAdditional things to note:\n${data.additional_notes || ''}\n\nResume:\n${resume}\n\nWhat day/time works best for you to speak with him this coming week?\n\n${signature || ''}`;
    setBody(defaultText);
  }, [data, signature]);
  const send = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const html = body.replace(/\n/g,'<br/>');
    // Normalize submission payload so backend can persist a row
    const submission: any = {};
    if (data) {
      if (data.type === 'submission') {
        submission.first_name = data.first_name || '';
        submission.last_name = data.last_name || '';
        submission.email = data.email || '';
        submission.phone = data.phone || '';
        submission.linkedin_url = data.linkedin_url || '';
        submission.title = data.title || '';
        submission.location = data.location || '';
        submission.years_experience = data.years_experience || '';
        submission.expected_compensation = data.expected_compensation || '';
        submission.resume_url = data.resume_url || '';
        submission.notable_impact = data.notable_impact || '';
        submission.motivation = data.motivation || '';
        submission.additional_notes = data.additional_notes || '';
      } else if (data.type === 'application') {
        // Map public application shape to submission-like
        const name = String(data.full_name || '').trim();
        const [fn, ...ln] = name.split(' ');
        submission.first_name = data.first_name || fn || '';
        submission.last_name = data.last_name || ln.join(' ') || '';
        submission.email = data.email || '';
        submission.linkedin_url = data.linkedin_url || '';
        submission.title = data.title || '';
        submission.location = data.location || '';
        submission.years_experience = data.years_experience || '';
        submission.resume_url = data.resume_url || '';
        submission.notable_impact = data.cover_note || '';
      }
      submission.form_json = data;
    }
    const resp = await fetch(`${(window as any).VITE_BACKEND_URL || (import.meta as any).env?.VITE_BACKEND_URL}/api/opportunities/${opportunityId}/submit-to-client`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', ...(token?{ Authorization:`Bearer ${token}` }:{}) },
      body: JSON.stringify({ to, subject, html, text: body, provider, submission })
    });
    if (resp.ok) {
      toast.success('Submitted to client');
      onClose();
    } else {
      const js = await resp.json().catch(()=>({}));
      toast.error(js?.error || 'Failed to send');
    }
  };
  return (
    <div>
      <div className="mb-3">
        <label className="text-xs text-gray-500 block mb-2">Send with</label>
        <div className="flex gap-3">
          {(['google','outlook','sendgrid'] as const).map((p)=> (
            <button key={p} className={`px-3 py-2 border rounded ${provider===p? 'ring-2 ring-green-500 border-green-500' : ''}`} onClick={()=>setProvider(p)}>
              {p==='google' && <span>G Google</span>}
              {p==='outlook' && <span>▦ Outlook</span>}
              {p==='sendgrid' && <span>✉️ SendGrid</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Hiring Manager Email</label>
          <input className="w-full border rounded px-2 py-2" value={to} onChange={e=>setTo(e.target.value)} placeholder="manager@company.com" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Subject</label>
          <input className="w-full border rounded px-2 py-2" value={subject} onChange={e=>setSubject(e.target.value)} />
        </div>
      </div>
      <label className="text-xs text-gray-500 block mb-1">Email Body</label>
      <textarea className="w-full border rounded px-3 py-2" rows={12} value={body} onChange={e=>setBody(e.target.value)} />
      <label className="text-xs text-gray-500 block mt-3 mb-1">Email Signature</label>
      <textarea className="w-full border rounded px-3 py-2" rows={4} value={signature} onChange={e=>setSignature(e.target.value)} placeholder="Your email signature…" />
      <div className="mt-3 text-right"><button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={send}>Submit to Client</button></div>
    </div>
  );
}


