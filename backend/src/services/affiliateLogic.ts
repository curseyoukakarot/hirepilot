type PlanMap = { [planCode: string]: number }; // cents

// DIY one-time bounties
export const DIY_BOUNTIES: PlanMap = {
  diy_starter: 5000,   // $50
  diy_pro: 10000,      // $100
  diy_team: 15000,     // $150
};

// DFY recurring: 10% (computed from invoice amount)
export const DFY_PERCENT = 0.10;
export const DFY_MAX_MONTHS = 6;
export const DIY_LOCK_DAYS = 14;

export function mapStripePriceToPlanCode(priceId?: string | null): string | null {
  const map: Record<string, string> = {
    [process.env.DIY_PRICE_ID_STARTER || '']: 'diy_starter',
    [process.env.DIY_PRICE_ID_PRO || '']: 'diy_pro',
    [process.env.DIY_PRICE_ID_TEAM || '']: 'diy_team',
  };
  if (!priceId) return null;
  return map[priceId] ?? null;
}


