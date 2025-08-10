import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
export function ReferralActivityTable() {
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{let mounted=true;let t:number|undefined;(async()=>{
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const fetchRows=async()=>{
      const r=await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/referrals`,{headers:{Authorization:`Bearer ${token}`},credentials:'include'});
      if(mounted&&r.ok)setRows(await r.json());
    };
    await fetchRows();
    t=window.setInterval(fetchRows,20000);
  })();return()=>{mounted=false;if(t)window.clearInterval(t);}},[]);
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold mb-3">Referral Activity</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th>Email</th><th>Plan</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map(r=>(<tr key={r.id}>
              <td>{r.lead_email ?? r.stripe_customer_id}</td>
              <td>{r.plan_type}</td>
              <td>{r.status}</td>
              <td>{new Date(r.first_attributed_at).toLocaleDateString()}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


