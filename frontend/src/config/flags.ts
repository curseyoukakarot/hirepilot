export const flags = {
  sniperV1: String(import.meta.env.VITE_SNIPER_V1_ENABLED || 'false').toLowerCase() === 'true',
  sniperIntelligence: String(import.meta.env.VITE_SNIPER_INTELLIGENCE_ENABLED || 'false').toLowerCase() === 'true',
  // v2 redesign — when true, /v2/* routes activate. Lets us ship the new architecture
  // alongside the existing app and roll out per-cohort. Default ON in dev so we can build.
  v2: String(import.meta.env.VITE_V2_ENABLED || 'true').toLowerCase() === 'true',
};


