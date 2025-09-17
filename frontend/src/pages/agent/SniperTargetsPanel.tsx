import React, { useEffect, useState } from 'react';
import SniperTargets from '../../screens/SniperTargets';
import { usePlan } from '../../context/PlanContext';
import { supabase } from '../../lib/supabaseClient';

export default function SniperTargetsPanel(){
  const { role } = usePlan() as any;
  const [blocked, setBlocked] = useState(true); // default: block for all

  useEffect(() => {
    (async () => {
      const r = String(role || '').toLowerCase().replace(/\s|-/g, '_');
      if (['super_admin','superadmin'].includes(r)) { setBlocked(false); return; }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const authRole = String((auth?.user?.user_metadata as any)?.role || (auth?.user?.user_metadata as any)?.account_type || '').toLowerCase().replace(/\s|-/g, '_');
        if (['super_admin','superadmin'].includes(authRole)) { setBlocked(false); return; }
      } catch {}
      try {
        const { data: row } = await supabase.from('users').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id).maybeSingle();
        const dbRole = String(row?.role || '').toLowerCase().replace(/\s|-/g, '_');
        if (['super_admin','superadmin'].includes(dbRole)) { setBlocked(false); return; }
      } catch {}
      setBlocked(true);
    })();
  }, [role]);

  if (blocked) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4 text-white">Sniper Targets</h2>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-1">Coming Soon</h3>
            <p className="text-sm text-blue-700">This feature will be ready shortly.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-white">Sniper Targets</h2>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <SniperTargets />
      </div>
    </div>
  );
}


