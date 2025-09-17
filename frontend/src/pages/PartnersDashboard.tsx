import React, { useEffect, useState } from 'react';
import { ReferralLinkCard } from '../ui/affiliate/ReferralLinkCard';
import { EarningsOverviewCard } from '../ui/affiliate/EarningsOverviewCard';
import { TierProgressCard } from '../ui/affiliate/TierProgressCard';
import { ReferralActivityTable } from '../ui/affiliate/ReferralActivityTable';
import { PayoutsTable } from '../ui/affiliate/PayoutsTable';
import { PromoteAssetsPanel } from '../ui/affiliate/PromoteAssetsPanel';
import { supabase } from '../lib/supabaseClient';

export default function PartnersDashboard() {
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    let timer: number | undefined;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const fetchOverview = async () => {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/affiliates/overview`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        });
        if (isMounted && res.ok) setOverview(await res.json());
      };
      await fetchOverview();
      timer = window.setInterval(fetchOverview, 15000);
    })();
    return () => { isMounted = false; if (timer) window.clearInterval(timer); };
  }, []);

  return (
    <div className="container mx-auto px-6 py-6">
      <div className="grid gap-6">
        <ReferralLinkCard />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <EarningsOverviewCard data={overview} />
        </div>
        <TierProgressCard />
        <div className="grid md:grid-cols-2 gap-6">
          <ReferralActivityTable />
          <PayoutsTable />
        </div>
        <PromoteAssetsPanel />
      </div>
    </div>
  );
}


