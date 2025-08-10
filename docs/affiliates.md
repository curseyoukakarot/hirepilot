## HirePilot Affiliate Program – Setup & Test Guide

### Prereqs
- Supabase project and service role key
- Stripe account (test mode OK) + Stripe Connect enabled
- Deployed backend (Railway) and frontend (Vercel)

### Environment variables (Backend)
Add to Railway/Backend `.env`:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_URL=https://thehirepilot.com
APP_BASE_URL=https://thehirepilot.com

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_REFRESH_URL=https://thehirepilot.com/partners/dashboard
STRIPE_CONNECT_RETURN_URL=https://thehirepilot.com/partners/dashboard

DIY_PRICE_ID_STARTER=price_xxx
DIY_PRICE_ID_PRO=price_xxx
DIY_PRICE_ID_TEAM=price_xxx

# Partner Pass (optional overrides)
PARTNER_PASS_THRESHOLD=5
PARTNER_PASS_FREE_MONTHS=3
PARTNER_PASS_LOOKBACK_DAYS=90
```

### Environment variables (Frontend)
Add to Vercel/Frontend:

```
VITE_BACKEND_URL= https://api.thehirepilot.com   # your backend base URL
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Database migration
- Push new tables, indexes, RLS, and RPCs:
  - File: `supabase/migrations/20250810080000_affiliates.sql`
  - File: `supabase/migrations/20250810083000_affiliate_rpcs.sql`

Apply via Supabase Studio SQL or CLI:

```
supabase db push
```

### Deploy
- Backend (Railway): deploy after adding env vars
- Frontend (Vercel): deploy after adding env vars
- Stripe webhook (test): point to `POST https://api.thehirepilot.com/api/stripe/webhook`

### Vercel rewrites
`frontend/vercel.json` includes:
- `/affiliates` → `/index.html`
- `/partners/:path*` → `/index.html`

### Features overview
- Public page: `/affiliates`
- Partner Dashboard: `/partners/dashboard`
- Cookie attribution: `?ref=<code>` sets `hp_ref` (90 days)
- Affiliate APIs (auth):
  - `POST /api/affiliates/register`
  - `GET /api/affiliates/link`
  - `POST /api/affiliates/connect/onboarding`
  - `GET /api/affiliates/overview`
  - `GET /api/affiliates/referrals`
  - `GET /api/affiliates/commissions`
  - `GET /api/affiliates/payouts`
- Checkout (auth): `POST /api/checkout/session`
- Stripe webhook: `POST /api/stripe/webhook` (raw, signature verified)
- Payout job (auth/admin): `POST /api/payouts/run`
- Partner Pass job (auth/admin): `POST /api/partner-pass/run`

### Commission rules (MVP)
- DIY: one-time bounties by plan — Starter $50, Pro $100, Team $150
- DFY: 10% of paid invoice amount, up to 6 months
- Lock: DIY commissions locked after 14 days (current implementation inserts as locked with `locked_at` future – can switch to pending + cron)

### End-to-end test (Stripe test mode)
1) Register as affiliate
   - Auth as a user
   - `POST /api/affiliates/register`
   - `GET /api/affiliates/link` → note URL (e.g., `https://thehirepilot.com/?ref=hp_xxxxxxxx`)
2) Attribution
   - Open incognito and visit your link → `hp_ref` cookie set (90 days)
3) Checkout (DIY)
   - From the normal UI or `POST /api/checkout/session` with `{ price_id, success_url, cancel_url }`
   - Ensure the Checkout metadata contains: `affiliate_id`, `referral_code`, `plan_type`, `price_id`, `user_id`
4) Webhook handling
   - Complete Stripe test checkout
   - Webhook should upsert `referrals` and insert a DIY `commissions` row with `status=locked`
   - `GET /api/affiliates/overview` should reflect lifetime/this-month values
5) Payouts
   - `POST /api/payouts/run` → moves locked to paid, creates Stripe transfer to Connect account
   - `GET /api/affiliates/payouts` shows the payout

### DFY test
- In Stripe dashboard, create a test invoice with metadata:
  - `plan_type="DFY"` and either `affiliate_id` or `referral_code`
- Mark invoice paid → webhook inserts `DFY_RECUR` commission for the month (capped at 6 months)

### Partner Pass (optional)
- After ≥ 5 active referrals in rolling 90 days, run:
  - `POST /api/partner-pass/run`
- Applies a 100% coupon for 3 months to the affiliate’s active subscription if no existing discount

### Security & operations
- Webhook signature validation enforced
- Consider adding: min payout threshold (e.g., $50), refund/void handling to mark commissions `void`
- Logging: Stripe webhook events logged via existing logging (optional)

### Notes
- Update `DIY_PRICE_ID_*` envs to match your Stripe prices
- `mapStripePriceToPlanCode` uses env-mapped price IDs
- Frontend partner dashboard uses Supabase session token for auth requests


