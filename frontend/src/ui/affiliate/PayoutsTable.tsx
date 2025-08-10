import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
export function PayoutsTable() {
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{let mounted=true;let t:number|undefined;(async()=>{
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const fetchRows=async()=>{
      const r=await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/payouts`,{headers:{Authorization:`Bearer ${token}`},credentials:'include'});
      if(mounted&&r.ok)setRows(await r.json());
    };
    await fetchRows();
    t=window.setInterval(fetchRows,20000);
  })();return()=>{mounted=false;if(t)window.clearInterval(t);}},[]);
  const money=(c:number)=>`$${(c/100).toFixed(2)}`;
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold mb-3">Payouts</h3>
      <table className="w-full text-sm">
        <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(p=>(<tr key={p.id}>
            <td>{new Date(p.created_at).toLocaleDateString()}</td>
            <td>{money(p.total_cents)}</td>
            <td>{p.method}</td>
            <td>{p.status}</td>
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}


