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
    <div id="opportunity-detail-page" className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <header id="header" className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="fas fa-arrow-left text-gray-500 cursor-pointer hover:text-gray-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Opportunity Details</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors" onClick={saveNotes}>
              <i className="fas fa-save mr-2"></i>Save Changes
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="main-content" className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div id="left-column" className="lg:col-span-2 space-y-6">
            {/* Opportunity Summary */}
            <section id="opportunity-summary" className="bg-white rounded-2xl shadow-md p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{opp.title}</h2>
                    <p className="text-lg text-gray-600">{opp.client?.name || opp.client?.domain || '—'}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">{opp.stage || 'Open'}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-600">Created {opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                      <p className="text-2xl font-bold text-green-600">{(Number(opp.value)||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{opp.billing_type || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                    <div className="flex items-center space-x-2">
                      <img src={opp.owner?.avatar_url || 'https://ui-avatars.com/api/?name=Owner&background=random'} className="w-8 h-8 rounded-full"/>
                      <span className="text-gray-900 font-medium">{opp.owner?.name || opp.owner?.email || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Description */}
            <section id="description-section" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
              <textarea className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" placeholder="Add opportunity description and notes..." value={notes} onChange={e=>setNotes(e.target.value)} />
              <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors" onClick={saveNotes}>
                <i className="fas fa-save mr-2"></i>Save Description
              </button>
            </section>

            {/* Linked Job Reqs */}
            <section id="linked-job-reqs" className="bg-white rounded-2xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Linked Job Requisitions</h3>
                <div className="flex items-center gap-2">
                  <select className="border rounded px-2 py-1 text-sm" value={newReqId} onChange={e=>setNewReqId(e.target.value)}>
                    <option value="">Select job req…</option>
                    {availableReqs.map((r:any)=> (<option key={r.id} value={r.id}>{r.title}</option>))}
                  </select>
                  <button className="text-indigo-600 hover:text-indigo-700 font-medium" onClick={attachReq}>
                    <i className="fas fa-plus mr-1"></i>Attach REQ
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {(opp.req_ids||[]).length===0 && <div className="text-sm text-gray-500">No linked REQs</div>}
                {(opp.req_ids||[]).map((rid:string)=> (
                  <div key={rid} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                    <div>
                      <span className="font-medium text-gray-900">{rid}</span>
                      <p className="text-gray-600">Linked REQ</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Candidates */}
            <section id="candidates-panel" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidates</h3>
              <div className="space-y-4">
                {(opp?.applications||[]).map((c:any) => (
                  <div key={`app-${c.id}`} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name||c.email||'Candidate')}&background=random`} className="w-10 h-10 rounded-full"/>
                        <div>
                          <h4 className="font-medium text-gray-900">{c.full_name || c.email}</h4>
                          <p className="text-gray-600 text-sm">{c.email}</p>
                        </div>
                      </div>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Applicant</span>
                    </div>
                    <div className="mt-3 flex items-center space-x-3">
                      {c.linkedin_url && <a className="text-blue-600 hover:text-blue-700 text-sm" href={c.linkedin_url} target="_blank" rel="noreferrer"><i className="fab fa-linkedin mr-1"></i>LinkedIn</a>}
                      {c.resume_url && <a className="text-gray-600 hover:text-gray-700 text-sm" href={c.resume_url} target="_blank" rel="noreferrer"><i className="fas fa-file-pdf mr-1"></i>Resume</a>}
                      <button className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700 transition-colors" onClick={()=>setDetailOpen({ type:'application', ...c })}>View Details</button>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 transition-colors" onClick={()=>setSubmitOpen({ open:true, data: { type:'application', ...c } })}>Submit to Client</button>
                    </div>
                  </div>
                ))}
                {(opp?.submissions||[]).map((c:any) => (
                  <div key={`sub-${c.id}`} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent([c.first_name,c.last_name].filter(Boolean).join(' ')||c.email||'Candidate')}&background=random`} className="w-10 h-10 rounded-full"/>
                        <div>
                          <h4 className="font-medium text-gray-900">{[c.first_name,c.last_name].filter(Boolean).join(' ') || c.email}</h4>
                          <p className="text-gray-600 text-sm">{c.email}</p>
                        </div>
                      </div>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Interested</span>
                    </div>
                    <div className="mt-3 flex items-center space-x-3">
                      {c.linkedin_url && <a className="text-blue-600 hover:text-blue-700 text-sm" href={c.linkedin_url} target="_blank" rel="noreferrer"><i className="fab fa-linkedin mr-1"></i>LinkedIn</a>}
                      {c.resume_url && <a className="text-gray-600 hover:text-gray-700 text-sm" href={c.resume_url} target="_blank" rel="noreferrer"><i className="fas fa-file-pdf mr-1"></i>Resume</a>}
                      <button className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700 transition-colors" onClick={()=>setDetailOpen({ type:'submission', ...c })}>View Details</button>
                      <button className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 transition-colors" onClick={()=>setSubmitOpen({ open:true, data: { type:'submission', ...c } })}>Submit to Client</button>
                    </div>
                  </div>
                ))}
                {(!((opp?.applications||[]).length || (opp?.submissions||[]).length)) && (
                  <div className="text-sm text-gray-500">No candidates yet</div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div id="right-column" className="space-y-6">
            {/* Assigned Team */}
            <section id="assigned-team" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Team</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={opp.owner?.avatar_url || 'https://ui-avatars.com/api/?name=Owner&background=random'} className="w-8 h-8 rounded-full"/>
                    <span className="text-gray-900 font-medium">{opp.owner?.name || opp.owner?.email || '—'}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Owner</span>
                  </div>
                </div>
                {(collabs||[]).map((c:any)=> (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.email||'User')}&background=random`} className="w-8 h-8 rounded-full"/>
                      <span className="text-gray-900">{c.email}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <select className="border rounded px-2 py-1 text-sm flex-1" value={newCollab} onChange={e=>setNewCollab(e.target.value)}>
                  <option value="">Select teammate…</option>
                  {availableUsers.map((u:any)=> (<option key={u.id} value={u.email}>{u.name}</option>))}
                </select>
                <button className="text-sm text-blue-600" onClick={addCollaborator}>Add</button>
              </div>
            </section>

            {/* Internal Notes */}
            <section id="internal-notes" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h3>
              <textarea className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm" placeholder="Add internal notes... Use @mention to tag teammates"></textarea>
              <button className="w-full mt-3 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors">Add Note</button>
              <div className="mt-4 space-y-3">
                {activity.slice(0,1).map((a:any)=> (
                  <div key={a.id} className="border-l-4 border-indigo-400 pl-3 py-2">
                    <p className="text-sm text-gray-700">{a.body || a.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(a.occurred_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* REX Insights */}
            <section id="rex-insights" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4"><i className="fas fa-brain text-purple-600 mr-2"></i>REX Insights</h3>
              <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg">
                <p className="text-sm text-gray-700 italic">"Based on market analysis, GIS Architects with 5+ years experience are commanding 15% higher salaries than last quarter. Consider highlighting remote work flexibility."</p>
              </div>
            </section>

            {/* Activity Log */}
            <section id="activity-log" className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Log</h3>
              <div className="space-y-3 mb-4">
                <select className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" value={newActType} onChange={e=>setNewActType(e.target.value as any)}>
                  <option value="note">Note</option>
                  <option value="email">Email</option>
                  <option value="call">Call</option>
                  <option value="update">Status Update</option>
                </select>
                <input type="text" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Add activity details..." value={newActivity} onChange={e=>setNewActivity(e.target.value)} />
                <button className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors" onClick={addActivity}>Log Activity</button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {activity.map((a:any)=> (
                  <div key={a.id} className="flex items-start space-x-3 text-sm">
                    <i className="fas fa-circle-info text-blue-500 mt-1"></i>
                    <div>
                      <p className="text-gray-700">{a.body || a.title}</p>
                      <p className="text-gray-500 text-xs">{new Date(a.occurred_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {activity.length===0 && <div className="text-sm text-gray-500">No activity yet</div>}
              </div>
            </section>
          </div>
        </div>
      </main>

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


