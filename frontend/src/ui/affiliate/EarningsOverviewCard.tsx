export function EarningsOverviewCard({ data }: { data: any }) {
  const money = (c:number)=> `$${(c/100).toFixed(2)}`;
  return (
    <div className="card p-5 col-span-4">
      <div className="grid md:grid-cols-4 gap-4">
        <Stat label="Lifetime Earnings" value={money(data?.lifetime_cents ?? 0)} />
        <Stat label="This Month" value={money(data?.this_month_cents ?? 0)} />
        <Stat label="Tier" value={data?.tier ?? 'starter'} />
        <Stat label="Next Payout (est.)" value={money(data?.next_payout_cents ?? 0)} />
      </div>
    </div>
  );
}
function Stat({label,value}:{label:string;value:string}) {
  return <div><div className="text-sm text-gray-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>
}


