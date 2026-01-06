## Job Seeker Elite — Custom Domains (White-label Landing Pages)

This repo now supports mapping **Elite** users’ public landing pages to a custom domain, while keeping the canonical URL working:

- **Canonical**: `app.thehirepilot.com/p/:slug`
- **White-label**: `https://yourname.com/` or `https://profile.yourname.com/`

### What was added

- **Supabase tables** (migration: `supabase/migrations/20260101090000_job_seeker_custom_domains.sql`)
  - `public.landing_pages`: stores `slug`, `html`, and `published`
  - `public.landing_page_domains`: stores domain mappings + verification tokens
- **Railway API endpoints**
  - `POST /api/landing-pages/upsert`
  - `GET /api/landing-pages/me`
  - `GET /api/landing-pages/by-slug/:slug` (public)
  - `POST /api/landing-domains/request`
  - `POST /api/landing-domains/verify`
  - `DELETE /api/landing-domains/:id`
  - `GET /api/landing-domains/by-landing-page/:landing_page_id`
  - `GET /api/landing-domains/resolve?host=example.com` (public)
- **Frontend**
  - `/p/:slug` renders the landing page HTML inside an iframe (`PublicLandingPage`)
  - `/` will render the landing page **only when the Host is a custom domain**, otherwise it shows the normal jobs marketing homepage
  - Elite-only **Custom Domain modal** inside the Landing Page Builder (matches existing visual style)

### DNS verification method

We verify ownership via a DNS TXT record:

- **Record type**: TXT  
- **Name**: `_hirepilot-verify.<your-domain>`  
- **Value**: `<verification_token>` (generated per request)

Example for `profile.yourname.com`:

- TXT name: `_hirepilot-verify.profile.yourname.com`

### Domain routing (to Vercel)

To actually serve the site + provision SSL, the domain must also route to the Vercel project hosting `jobs.thehirepilot.com`.

Typical Vercel DNS setup:

- **Apex** (`yourname.com`): A record `@` → `76.76.21.21`
- **Subdomain** (`profile.yourname.com`): CNAME `profile` → `cname.vercel-dns.com`

Also add the domain in **Vercel Project Settings → Domains** for the jobs project so Vercel can provision the certificate.

### Required / recommended env vars

- **Frontend (Vercel)**:
  - **`VITE_BACKEND_URL`**: must point to the Railway API base (e.g. `https://api.thehirepilot.com`)

- **Backend (Railway)**:
  - **`CORS_ALLOW_ANY_HTTPS=true`** (recommended for custom domains)
    - Custom domains will call the public resolve endpoints cross-origin.
    - This flag allows any `https://*` origin through the existing CORS gate.
  - **`DNS_VERIFY_TIMEOUT_MS`** (optional): DNS TXT lookup timeout (default `2500`)

### UX flow (Elite user)

1. Build landing page → **Save** → **Publish**
2. Click **Custom Domain** → enter domain → **Request**
3. Add the TXT record shown in the modal
4. Point the domain to Vercel (A/CNAME) and add the domain in Vercel project settings
5. Back in the modal → **Verify**
6. Visit `https://your-domain/` → landing page renders (white-labeled)


