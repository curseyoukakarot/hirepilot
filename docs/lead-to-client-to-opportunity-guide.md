# Public API Guide: Lead → Client → Opportunity

Convert a HirePilot lead into a client and then create an opportunity (deal) tied to that client — all over the public API using your `X-API-Key`. This is the canonical workflow for agents, Zapier/Make scenarios, and your own automations to push qualified leads into your pipeline.

## What this guide covers

1. The 2-step flow at a glance.
2. Step 1 — Convert a **lead** to a **client** (with optional decision-maker contacts).
3. Step 2 — Create an **opportunity** attached to that `client_id`.
4. Read endpoints to verify what you created.
5. Common errors and how to handle them.
6. End-to-end recipes for Zapier, Make, REX agents, and Node scripts.

> All endpoints below are under the public Zapier router (`/api/zapier/*`) and authenticated by `X-API-Key`. The API key's owning user is automatically used as the owner of any rows you create or read. You cannot read or write rows owned by another user.

---

## Authentication

Every request needs your HirePilot API key in the `X-API-Key` header.

```http
X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Generate / rotate keys in-app: **Settings → API Keys**.

| Status | Body                                                                              |
|--------|-----------------------------------------------------------------------------------|
| 401    | `{ "error": "Missing X-API-Key header" }` or `{ "error": "Invalid API key" }`     |
| 403    | `{ "error": "Forbidden" }` / `{ "error": "Forbidden (client)" }` — row belongs to another user |

---

## Base URL

```
https://api.thehirepilot.com
```

(Replace with your self-hosted backend host where applicable.)

---

## The flow at a glance

```
┌─────────────┐   POST /api/zapier/leads/:id/convert-to-client    ┌──────────────┐
│  Lead       │ ────────────────────────────────────────────────► │   Client     │
│  (people)   │                                                    │   (company)  │
└─────────────┘                                                    └──────┬───────┘
                                                                          │ client.id
                                                                          ▼
                                                            POST /api/zapier/opportunities
                                                                          │
                                                                          ▼
                                                                  ┌──────────────┐
                                                                  │ Opportunity  │
                                                                  │ (deal)       │
                                                                  └──────────────┘
```

You will:

1. Have (or create) a lead in HirePilot.
2. Call **convert-to-client** to promote that lead's company into a `clients` row, optionally attaching decision-maker contacts. The endpoint returns `client.id`.
3. Call **POST /api/zapier/opportunities** with that `client_id` plus your deal fields (`title`, `value`, `stage`, etc.). The endpoint returns the new `opportunity.id`.

---

## Step 1 — Convert a lead to a client

`POST /api/zapier/leads/:id/convert-to-client`

Promotes the lead's company information into a `clients` row owned by the API-key user. Pulls company metadata (domain, industry, revenue, location) from the lead's `enrichment_data.apollo.organization` payload when available. Optionally seeds decision-maker `contacts` rows. By default it also flips the lead to `status = "archived"`.

### Path params

| Name | Type | Description                                |
|------|------|--------------------------------------------|
| id   | UUID | The `leads.id` you want to convert         |

### Body (JSON)

| Field              | Type     | Required | Default | Description                                                                                                                                                  |
|--------------------|----------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `include_contacts` | boolean  | no       | `false` | If `true`, inserts decision-maker rows into `contacts`.                                                                                                       |
| `contacts`         | object[] | no       | `[]`    | Used only when `include_contacts=true`. Each item: `{ name?, title?, email?, phone? }`.                                                                       |
| `archive_lead`     | boolean  | no       | `true`  | When `true`, the lead's `status` is set to `archived` after conversion.                                                                                       |

### Example request

```bash
curl -X POST "https://api.thehirepilot.com/api/zapier/leads/2f6e...c1/convert-to-client" \
  -H "X-API-Key: $HIREPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "include_contacts": true,
    "contacts": [
      { "name": "Ada Lovelace", "title": "CEO",  "email": "ada@example.com", "phone": "+1-555-0100" },
      { "name": "Alan Turing",  "title": "CTO",  "email": "alan@example.com" }
    ],
    "archive_lead": true
  }'
```

### Example response — `200 OK`

```json
{
  "success": true,
  "client": {
    "id": "9a2c...77",
    "owner_id": "8a1c...77",
    "name": "Analytical Engines Inc",
    "domain": "analytical-engines.com",
    "industry": "Software",
    "revenue": 25000000,
    "location": "London, UK",
    "created_at": "2026-05-14T17:30:01.123Z"
  },
  "contacts": [
    { "id": "c-1", "client_id": "9a2c...77", "name": "Ada Lovelace", "title": "CEO",  "email": "ada@example.com" },
    { "id": "c-2", "client_id": "9a2c...77", "name": "Alan Turing",  "title": "CTO",  "email": "alan@example.com" }
  ],
  "lead_archived": true
}
```

> Hold on to **`client.id`** — you'll pass it as `client_id` to the opportunity endpoint in step 2.

### Errors

| Status | Body                              | When                                |
|--------|-----------------------------------|-------------------------------------|
| 400    | `{ "error": "Missing lead id" }`  | `:id` is empty                       |
| 403    | `{ "error": "Forbidden" }`        | Lead is owned by a different user    |
| 404    | `{ "error": "Lead not found" }`   | Lead doesn't exist                   |
| 500    | `{ "error": "failed_create_client" }` | DB error during client insert    |

### Side effects

- A `client_created` Zap event is emitted (visible at `GET /api/zapier/triggers/events?event_type=client_created`).
- A `lead_converted` Zap event is emitted (`event_type=lead_converted`).
- If `archive_lead=true` (default), the lead's `status` is set to `archived`.

---

## Step 2 — Create an opportunity for that client

`POST /api/zapier/opportunities`

Creates a row in `opportunities` owned by the API-key user, attached to the `client_id` you obtained in step 1. The handler verifies the client belongs to your user (otherwise `403`).

### Body (JSON)

| Field             | Type    | Required | Default      | Description                                                                                              |
|-------------------|---------|----------|--------------|----------------------------------------------------------------------------------------------------------|
| `title`           | string  | yes      | —            | Free-form deal name, e.g. `"VP of Engineering search"`.                                                  |
| `client_id`       | UUID    | yes      | —            | Must be a `clients.id` owned by the API-key user (returned from step 1).                                  |
| `stage`           | string  | no       | `null`       | Free-form pipeline stage label, e.g. `"Pipeline"`, `"Discovery"`, `"Proposal"`, `"Close Won"`.            |
| `status`          | string  | no       | `"open"`     | Lifecycle status, e.g. `"open"`, `"won"`, `"lost"`.                                                       |
| `value`           | number  | no       | `null`       | Deal value (currency-agnostic numeric).                                                                  |
| `billing_type`    | string  | no       | `null`       | E.g. `"contingency"`, `"retained"`, `"one_time"`, or your own taxonomy.                                   |
| `tag`             | string  | no       | `null`       | Single tag, e.g. `"rss"`, `"job_seeker"`, `"inbound"`.                                                    |
| `forecast_date`   | string  | no       | `null`       | `YYYY-MM-DD` (or ISO timestamp; only the date portion is stored). Expected close date.                    |
| `start_date`      | string  | no       | `null`       | `YYYY-MM-DD` (or ISO timestamp). Engagement start date.                                                   |
| `term_months`     | number  | no       | `null`       | Must be one of `1`, `3`, `6`, `12`.                                                                       |
| `margin`          | number  | no       | `null`       | Margin amount.                                                                                            |
| `margin_type`     | string  | no       | `"currency"` | One of `"currency"` or `"percent"`.                                                                       |
| `idempotency_key` | string  | no       | —            | If supplied, repeat calls with the same key dedupe and return `{ deduped: true, opportunity }`.           |

### Example request

```bash
curl -X POST "https://api.thehirepilot.com/api/zapier/opportunities" \
  -H "X-API-Key: $HIREPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "VP of Engineering search — Analytical Engines Inc",
    "client_id": "9a2c...77",
    "stage": "Pipeline",
    "status": "open",
    "value": 35000,
    "billing_type": "contingency",
    "tag": "inbound",
    "forecast_date": "2026-08-01",
    "start_date": "2026-06-15",
    "term_months": 6,
    "margin": 22.5,
    "margin_type": "percent",
    "idempotency_key": "lead-2f6e...c1-vpe-search"
  }'
```

### Example response — `201 Created`

```json
{
  "success": true,
  "opportunity": {
    "id": "d40e...91",
    "title": "VP of Engineering search — Analytical Engines Inc",
    "client_id": "9a2c...77",
    "owner_id": "8a1c...77",
    "stage": "Pipeline",
    "status": "open",
    "value": 35000,
    "billing_type": "contingency",
    "tag": "inbound",
    "forecast_date": "2026-08-01",
    "start_date": "2026-06-15",
    "term_months": 6,
    "margin": 22.5,
    "margin_type": "percent",
    "created_at": "2026-05-14T17:31:00.000Z",
    "updated_at": "2026-05-14T17:31:00.000Z"
  }
}
```

### Repeat call (same `idempotency_key`) — `200 OK`

```json
{
  "deduped": true,
  "opportunity": {
    "id": "d40e...91",
    "title": "VP of Engineering search — Analytical Engines Inc",
    "client_id": "9a2c...77",
    "stage": "Pipeline",
    "status": "open"
  }
}
```

### Errors

| Status | Body                                                              | When                                                                   |
|--------|-------------------------------------------------------------------|------------------------------------------------------------------------|
| 400    | `{ "error": "title is required" }`                                | `title` missing or empty                                               |
| 400    | `{ "error": "client_id is required" }`                            | `client_id` missing or empty                                           |
| 400    | `{ "error": "client_id not found" }`                              | No `clients` row matches that id                                       |
| 400    | `{ "error": "invalid value" }`                                    | `value` not a finite number                                            |
| 400    | `{ "error": "invalid forecast_date" }` / `"invalid start_date"`   | Date not in `YYYY-MM-DD` (or parsable as such)                         |
| 400    | `{ "error": "invalid term_months (must be 1, 3, 6, or 12)" }`     | `term_months` not in the allowed set                                   |
| 400    | `{ "error": "invalid margin" }`                                   | `margin` not a finite number                                           |
| 400    | `{ "error": "invalid margin_type (must be \"currency\" or \"percent\")" }` | `margin_type` invalid                                          |
| 401    | Auth error                                                        | Missing/invalid API key                                                |
| 403    | `{ "error": "Forbidden (client)" }`                               | The `client_id` exists but is owned by a different user                |
| 500    | `{ "error": "..." }`                                              | DB / unexpected error                                                  |

---

## Verifying what you created

Both rows are read-back on the same auth.

### Read the opportunity

`GET /api/zapier/opportunities/:id`

```bash
curl "https://api.thehirepilot.com/api/zapier/opportunities/d40e...91" \
  -H "X-API-Key: $HIREPILOT_API_KEY"
```

```json
{
  "opportunity": {
    "id": "d40e...91",
    "title": "VP of Engineering search — Analytical Engines Inc",
    "client_id": "9a2c...77",
    "owner_id": "8a1c...77",
    "stage": "Pipeline",
    "status": "open"
  }
}
```

### Read the lead the client was created from

`GET /api/zapier/leads/:id`

### Tail Zap events

`GET /api/zapier/triggers/events?event_type=client_created&since={ISO}`
`GET /api/zapier/triggers/events?event_type=lead_converted&since={ISO}`

---

## End-to-end recipes

### 4.1 Pure cURL

```bash
LEAD_ID=2f6e...c1
KEY=$HIREPILOT_API_KEY
BASE=https://api.thehirepilot.com

# 1) Convert lead → client
CLIENT_ID=$(curl -s -X POST "$BASE/api/zapier/leads/$LEAD_ID/convert-to-client" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"include_contacts":true,"contacts":[{"name":"Ada Lovelace","title":"CEO","email":"ada@example.com"}]}' \
  | jq -r '.client.id')

echo "Client created: $CLIENT_ID"

# 2) Create opportunity tied to that client
curl -s -X POST "$BASE/api/zapier/opportunities" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d "{
        \"title\": \"VP of Engineering search\",
        \"client_id\": \"$CLIENT_ID\",
        \"stage\": \"Pipeline\",
        \"value\": 35000,
        \"billing_type\": \"contingency\",
        \"forecast_date\": \"2026-08-01\",
        \"idempotency_key\": \"lead-$LEAD_ID-vpe-search\"
      }" | jq .
```

### 4.2 Node / TypeScript

```ts
import axios from "axios";

const API = "https://api.thehirepilot.com";
const KEY = process.env.HIREPILOT_API_KEY!;
const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };

export async function leadToOpportunity(leadId: string, opportunity: {
  title: string;
  value?: number;
  stage?: string;
  billing_type?: string;
  forecast_date?: string; // YYYY-MM-DD
  tag?: string;
  idempotency_key?: string;
}) {
  // 1) Convert lead to client
  const { data: conv } = await axios.post(
    `${API}/api/zapier/leads/${leadId}/convert-to-client`,
    { include_contacts: false },
    { headers }
  );
  const clientId = conv.client.id;

  // 2) Create opportunity for that client
  const { data: created } = await axios.post(
    `${API}/api/zapier/opportunities`,
    { client_id: clientId, ...opportunity },
    { headers }
  );

  return { client: conv.client, opportunity: created.opportunity };
}
```

### 4.3 Zapier (multi-step Zap)

1. **Trigger** — your inbound source (form submission, RSS hit, CRM event, etc.).
2. **Find or Create Lead** — call `POST /api/zapier/leads` (already supported) with the lead's email/company.
3. **Action — Webhooks → POST**:
   - URL: `https://api.thehirepilot.com/api/zapier/leads/{{lead_id}}/convert-to-client`
   - Header: `X-API-Key`
   - Body: `{ "include_contacts": false, "archive_lead": true }`
   - **Map output → step 4**: pull `client.id`.
4. **Action — Webhooks → POST**:
   - URL: `https://api.thehirepilot.com/api/zapier/opportunities`
   - Header: `X-API-Key`
   - Body:

```json
{
  "title": "{{title_from_step1}}",
  "client_id": "{{step3.client.id}}",
  "stage": "Pipeline",
  "value": 35000,
  "billing_type": "contingency",
  "forecast_date": "{{forecast_iso}}",
  "idempotency_key": "{{lead_id}}-{{title_slug}}"
}
```

The `idempotency_key` ensures Zap retries don't create duplicate deals.

### 4.4 Make.com

Mirror the Zapier flow above with two HTTP modules pointing at `convert-to-client` and `/opportunities`. Use Make's "Get a JSON value" or `{1.client.id}` mapping into the second module's `client_id`.

### 4.5 REX agent / internal automation

Inside your agent, call the two endpoints sequentially with the same shared HTTP client. The endpoints are identical to the Zapier ones — no special agent flag needed; the X-API-Key is your auth.

---

## Idempotency & retries

- **Conversion** does not require an idempotency key; calling it twice for the same lead simply creates a new `clients` row each time. To avoid duplicates, check `GET /api/clients?domain=...` (session API) or guard your automation with a flag in your source system.
- **Opportunity creation** is idempotent **per `(user_id, idempotency_key)`** when you provide `idempotency_key`. Without it, repeat calls **will** create duplicate deals. Always pass `idempotency_key` from automations.

---

## Reference

| Endpoint                                         | Method | Auth        | Purpose                                              |
|--------------------------------------------------|--------|-------------|------------------------------------------------------|
| `/api/zapier/leads/:id/convert-to-client`        | POST   | X-API-Key   | Convert a lead to a client (+ optional contacts)     |
| `/api/zapier/leads/:id`                          | GET    | X-API-Key   | Read a lead                                          |
| `/api/zapier/opportunities`                      | POST   | X-API-Key   | Create an opportunity tied to a `client_id`          |
| `/api/zapier/opportunities/:id`                  | GET    | X-API-Key   | Read an opportunity                                  |
| `/api/zapier/triggers/events?event_type=client_created` | GET | X-API-Key | Poll for newly created clients                       |
| `/api/zapier/triggers/events?event_type=lead_converted` | GET | X-API-Key | Poll for converted leads                             |

### Implementation pointers (for maintainers)

| Endpoint                                         | Handler location (`backend/api/zapierRouter.ts`) |
|--------------------------------------------------|---------------------------------------------------|
| `POST /api/zapier/leads/:id/convert-to-client`   | `router.post('/leads/:id/convert-to-client', ...)` |
| `POST /api/zapier/opportunities`                 | `router.post('/opportunities', ...)`              |
| `GET  /api/zapier/opportunities/:id`             | `router.get('/opportunities/:id', ...)`           |

- All endpoints use `apiKeyAuth` (`backend/middleware/apiKeyAuth.ts`).
- `clients` ownership is enforced via `clients.owner_id = req.user.id`.
- `opportunities` ownership is enforced via `opportunities.owner_id = req.user.id`.
- See `supabase/migrations/20250920_deals_opportunities.sql` and the follow-up migrations (`20251108_opportunities_tag.sql`, `20251230090000_add_forecast_date_to_opportunities.sql`, `20260111000000_add_opportunity_start_term_margin.sql`) for the table shape.
