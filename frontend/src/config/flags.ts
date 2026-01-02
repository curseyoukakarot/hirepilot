export const flags = {
  sniperV1: String(import.meta.env.VITE_SNIPER_V1_ENABLED || 'false').toLowerCase() === 'true',
  sniperIntelligence: String(import.meta.env.VITE_SNIPER_INTELLIGENCE_ENABLED || 'false').toLowerCase() === 'true'
};


