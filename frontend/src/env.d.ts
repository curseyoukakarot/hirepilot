/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRICE_ID_STARTER_MONTHLY: string;
  readonly VITE_STRIPE_PRICE_ID_STARTER_ANNUAL: string;
  readonly VITE_STRIPE_PRICE_ID_PRO_MONTHLY: string;
  readonly VITE_STRIPE_PRICE_ID_PRO_ANNUAL: string;
  readonly VITE_STRIPE_PRICE_ID_TEAM_MONTHLY: string;
  readonly VITE_STRIPE_PRICE_ID_TEAM_ANNUAL: string;
  readonly VITE_STRIPE_PRICE_ID_JS_PRO_MONTHLY: string;
  readonly VITE_STRIPE_PRICE_ID_JS_PRO_ANNUAL: string;
  readonly VITE_STRIPE_PRICE_ID_JS_ELITE_MONTHLY: string;
  readonly VITE_STRIPE_PRICE_ID_JS_ELITE_ANNUAL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 