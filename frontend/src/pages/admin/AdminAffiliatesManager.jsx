import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminAffiliatesManager(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ user_id:'', referral_code:'', status:'active', tier:'' });

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
      if(!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRows(data);
    }catch(e){ setError(e.message||'Failed'); }
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  async function create(){
    setError('');
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates`,{
        method:'POST', headers: await authHeaders(), credentials:'include', body: JSON.stringify(form)
      });
      if(!res.ok) throw new Error('Create failed');
      setForm({ user_id:'', referral_code:'', status:'active', tier:'' });
      await load();
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function update(id, patch){
    setError('');
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}`,{
        method:'PATCH', headers: await authHeaders(), credentials:'include', body: JSON.stringify(patch)
      });
      if(!res.ok) throw new Error('Update failed');
      await load();
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function remove(id){
    if(!confirm('Delete affiliate? This does NOT delete the HirePilot user account.')) return;
    setError('');
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}`,{
        method:'DELETE', headers: await authHeaders(), credentials:'include'
      });
      if(!res.ok) throw new Error('Delete failed');
      await load();
    }catch(e){ setError(e.message||'Failed'); }
  }

  async function reassign(id){
    const referral_code = prompt('Enter new referral code (leave blank to auto-generate):') || '';
    setError('');
    try{
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/affiliates/${id}/reassign`,{
        method:'POST', headers: await authHeaders(), credentials:'include', body: JSON.stringify({ referral_code })
      });
      if(!res.ok) throw new Error('Reassign failed');
      await load();
    }catch(e){ setError(e.message||'Failed'); }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Affiliates Manager</h1>
      {error && <div className="mb-3 text-red-600">{error}</div>}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-medium mb-2">Create / Upsert Affiliate</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="User ID" value={form.user_id} onChange={e=>setForm({...form,user_id:e.target.value})} />
          <input className="border rounded px-3 py-2" placeholder="Referral Code (optional)" value={form.referral_code} onChange={e=>setForm({...form,referral_code:e.target.value})} />
          <select className="border rounded px-3 py-2" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <input className="border rounded px-3 py-2" placeholder="Tier (optional)" value={form.tier} onChange={e=>setForm({...form,tier:e.target.value})} />
        </div>
        <div className="mt-3">
          <button onClick={create} className="px-4 py-2 bg-blue-600 text-white rounded">Save Affiliate</button>
        </div>
      </div>

      <div className="overflow-auto">
        {loading ? 'Loading…' : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">User ID</th>
                <th className="py-2 pr-4">Referral Code</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Tier</th>
                <th className="py-2 pr-4">Earnings</th>
                <th className="py-2 pr-4">Recent Deal</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r)=> (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{r.user_id}</td>
                  <td className="py-2 pr-4">{r.referral_code}</td>
                  <td className="py-2 pr-4">
                    <select className="border rounded px-2 py-1" value={r.status||'active'} onChange={e=>update(r.id,{ status:e.target.value })}>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input className="border rounded px-2 py-1" defaultValue={r.tier||''} onBlur={e=>update(r.id,{ tier:e.target.value })} />
                  </td>
                  <td className="py-2 pr-4">${(r.earnings_cents||0/100).toFixed(2)}</td>
                  <td className="py-2 pr-4">${(r.recent_deal_cents||0/100).toFixed(2)}</td>
                  <td className="py-2 pr-4 space-x-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>reassign(r.id)}>Reassign Link</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={()=>remove(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


