export function TierProgressCard() {
  // TODO: fetch tier + counts; render progress bar + badges
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold mb-2">Your Partner Tier</h3>
      <div className="bg-gray-200 h-2 rounded"><div className="bg-green-500 h-2 rounded" style={{width:'40%'}}/></div>
      <div className="text-sm text-gray-500 mt-2">3 more referrals to unlock Elite tier</div>
    </div>
  );
}


