import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminAffiliatesManager(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [form, setForm] = useState({ user_id:'', referral_code:'', status:'active', tier:'' });
  const [editingId, setEditingId] = useState(null);

  // Filters
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');

  async function authHeaders(){
    const { data: { session } } = await supabase.auth.getSession();
    const h = { 'Content-Type':'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }

  async function load(){
    setLoading(true); setError('');
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates`,{ headers: await authHeaders(), credentials:'include' });
      if(!res.ok) throw new Error('Failed to load affiliates');
      const data = await res.json();
      setRows(data);
    }catch(e){ setError(e.message||'Failed'); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  function clearMessages(){ setError(''); setSuccess(''); }

  async function save(){
    clearMessages();
    try{
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId
        ? `${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${editingId}`
        : `${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates`;
      const res = await fetch(url,{
        method,
        headers: await authHeaders(),
        credentials:'include',
        body: JSON.stringify(form)
      });
      if(!res.ok) throw new Error(editingId ? 'Update failed' : 'Create failed');
      setSuccess(editingId ? 'Affiliate updated' : 'Affiliate created');
      setForm({ user_id:'', referral_code:'', status:'active', tier:'' });
      setEditingId(null);
      await load();
      setTimeout(()=>setSuccess(''), 2000);
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function updateField(id, patch){
    clearMessages();
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}`,{
        method:'PATCH', headers: await authHeaders(), credentials:'include', body: JSON.stringify(patch)
      });
      if(!res.ok) throw new Error('Update failed');
      await load();
      setSuccess('Updated');
      setTimeout(()=>setSuccess(''), 1500);
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function remove(id){
    if(!confirm('Delete affiliate? This does NOT delete the HirePilot user account.')) return;
    clearMessages();
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}`,{
        method:'DELETE', headers: await authHeaders(), credentials:'include'
      });
      if(!res.ok) throw new Error('Delete failed');
      await load();
      setSuccess('Deleted');
      setTimeout(()=>setSuccess(''), 1500);
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function reassign(id){
    const referral_code = prompt('Enter new referral code (leave blank to auto-generate):') || '';
    clearMessages();
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}/reassign`,{
        method:'POST', headers: await authHeaders(), credentials:'include', body: JSON.stringify({ referral_code })
      });
      if(!res.ok) throw new Error('Reassign failed');
      await load();
      setSuccess('Link reassigned');
      setTimeout(()=>setSuccess(''), 1500);
    }catch(e){ setError(e.message||'Failed'); }
  }

  const filtered = rows.filter(r=>{
    const matchesQuery = !query || (r.user_id||'').toLowerCase().includes(query.toLowerCase()) || (r.referral_code||'').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = filterStatus==='all' || (r.status||'active')===filterStatus;
    const matchesTier = filterTier==='all' || String(r.tier||'').toLowerCase()===filterTier.toLowerCase();
    return matchesQuery && matchesStatus && matchesTier;
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Affiliates Manager</h1>

      {error && (<div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>)}
      {success && (<div className="mb-4 p-3 rounded bg-green-50 text-green-700 border border-green-200">{success}</div>)}

      {/* Create / Update Card */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Update Affiliate' : 'Create / Update Affiliate'}</h2>
          {editingId && (
            <button className="text-sm text-gray-600 hover:text-gray-800" onClick={()=>{ setEditingId(null); setForm({ user_id:'', referral_code:'', status:'active', tier:'' }); }}>Clear</button>
          )}
        </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={e=>{ e.preventDefault(); save(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <input required className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="User ID" value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code (optional)</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Referral Code (optional)" value={form.referral_code} onChange={e=>setForm({...form,referral_code:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier (optional)</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tier (optional)" value={form.tier} onChange={e=>setForm({...form,tier:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="active">active</option>
              <option value="disabled">inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">{editingId ? 'Save Changes' : 'Save Affiliate'}</button>
          </div>
        </form>
      </section>

      {/* List Tools */}
      <section className="mb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-lg font-semibold">Affiliate List</h2>
          <div className="flex gap-2">
            <input className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search by user or code" value={query} onChange={e=>setQuery(e.target.value)} />
            <select className="border rounded-lg px-3 py-2" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Inactive</option>
            </select>
            <select className="border rounded-lg px-3 py-2" value={filterTier} onChange={e=>setFilterTier(e.target.value)}>
              <option value="all">All Tiers</option>
              <option value="">No Tier</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="overflow-x-auto rounded-xl">
          {loading ? (
            <div className="p-6 text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-gray-600">No affiliates yet – add your first one above!</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Referral Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Earnings</th>
                  <th className="px-4 py-3">Recent Deal</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx)=>(
                  <tr key={r.id} className={`${idx%2===0?'bg-white':'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                    <td className="px-4 py-3 font-mono text-xs">{r.user_id}</td>
                    <td className="px-4 py-3">{r.referral_code}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full border ${ (r.status||'active')==='active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200' }`}>
                        {(r.status||'active')==='active' ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input className="border rounded px-2 py-1 w-28" defaultValue={r.tier||''} onBlur={e=>updateField(r.id,{ tier:e.target.value })} />
                    </td>
                    <td className="px-4 py-3">${(((r.earnings_cents||0))/100).toFixed(2)}</td>
                    <td className="px-4 py-3">{(r.recent_deal_cents||0) > 0 ? `$${(((r.recent_deal_cents||0))/100).toFixed(2)}` : 'None yet'}</td>
                    <td className="px-4 py-3 space-x-2">
                      <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={()=>{ setEditingId(r.id); setForm({ user_id:r.user_id||'', referral_code:r.referral_code||'', status:r.status||'active', tier:r.tier||'' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                      <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={()=>reassign(r.id)}>Reassign</button>
                      <button className="px-3 py-1 border rounded text-red-600 hover:bg-red-50" onClick={()=>remove(r.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

