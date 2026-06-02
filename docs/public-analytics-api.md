# Public Campaign Analytics API (V1)

These endpoints expose the same **campaign outreach data** shown on the in‑app **Campaign Performance / Analytics** page (Leads Messaged, Open Rate, Reply Rate, Conversion Rate, Converted Candidates, and time‑series for charting) — plus the **actual inbound reply messages** leads send back — to third‑party tools (Zapier, Make, n8n, BI dashboards, your own scripts) using a HirePilot API key.

> The API returns data scoped to the user (and team) that owns the API key, and it honors your team's **analytics‑sharing** setting exactly like the dashboard does. If a team admin has disabled analytics sharing, these endpoints return `403 analytics_sharing_disabled`.

---

## Authentication

- Generate an API key in‑app: **Settings → API Keys**.
- Send it on every request via the `X-API-Key` header, or as a Bearer token.

```http
X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

```http
Authorization: Bearer hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

The key must carry the **`analytics:read`** scope. Keys created after this feature shipped include it automatically. If you have an older key, generate a new one (or ask an admin to add the scope).

### Auth error responses

| Status | Body | Meaning |
|--------|------|---------|
| `401` | `{ "error": "unauthorized" }` | Missing or invalid API key |
| `403` | `{ "error": "insufficient_scope", "missing": ["analytics:read"] }` | Key is valid but lacks the `analytics:read` scope |
| `403` | `{ "error": "analytics_sharing_disabled" }` | A team admin has turned off analytics sharing |

---

## Base URL

```
https://api.thehirepilot.com
```

(Replace with your self‑hosted backend host, e.g. `https://your-backend.example.com`, when applicable.)

All routes below are mounted under `/v1/analytics`.

---

## 1) List campaigns

`GET /v1/analytics/campaigns`

Returns the campaigns owned by the API key's user (and team, where applicable), with basic lead counts. Use the returned `id` values with the performance and time‑series endpoints.

### Example request

```bash
curl -s https://api.thehirepilot.com/v1/analytics/campaigns \
  -H "X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Example response

```json
{
  "campaigns": [
    {
      "id": "7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c",
      "name": "campaign 1 - microsoft",
      "status": "active",
      "created_at": "2026-05-01T14:22:09.000Z",
      "total_leads": 122,
      "enriched_leads": 0
    }
  ]
}
```

---

## 2) Campaign performance (summary metrics)

`GET /v1/analytics/campaigns/:id/performance`

Returns the headline KPIs for a single campaign. These are the same numbers behind the metric cards on the Campaign Performance page.

### Path params

| Name | Type | Description |
|------|------|-------------|
| `id` | UUID \| `all` | A campaign id, or the literal `all` to aggregate across every campaign |

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `sent` | number | Distinct messages sent (Leads Messaged) |
| `opens` | number | Distinct messages opened |
| `open_rate` | number | `opens / sent * 100` |
| `replies` | number | Distinct messages that received a reply |
| `reply_rate` | number | `replies / sent * 100` |
| `conversions` | number | Conversion events recorded against sent messages |
| `conversion_rate` | number | `conversions / sent * 100` |
| `total_leads` | number | Leads in the campaign (or all leads when `id=all`) |
| `converted_candidates` | number | Leads that converted to candidates |

### Example request

```bash
curl -s https://api.thehirepilot.com/v1/analytics/campaigns/7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c/performance \
  -H "X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Example response

```json
{
  "sent": 122,
  "opens": 92,
  "open_rate": 75.4,
  "replies": 1,
  "reply_rate": 0.8,
  "conversions": 0,
  "conversion_rate": 0,
  "total_leads": 122,
  "converted_candidates": 0
}
```

### Aggregate across all campaigns

`GET /v1/analytics/campaigns/all/performance`

```bash
curl -s https://api.thehirepilot.com/v1/analytics/campaigns/all/performance \
  -H "X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Returns the same shape as above, summed across all of the caller's campaigns and messages.

---

## 3) Performance time‑series (for charts)

Time‑bucketed metrics for plotting the **Performance Overview** chart over time.

Two equivalent forms:

`GET /v1/analytics/campaigns/:id/time-series`
`GET /v1/analytics/time-series?campaign_id=<id|all>`

### Query params

| Name | Type | Default | Values |
|------|------|---------|--------|
| `campaign_id` | UUID \| `all` | `all` | Only on the `/time-series` form; the `/campaigns/:id/time-series` form takes it from the path |
| `time_range` | string | `30d` | `30d`, `90d`, `1y` |

The bucket interval is chosen automatically from the range (`day` for `30d`, `week` for `90d`, `month` for `1y`).

### Example request

```bash
curl -s "https://api.thehirepilot.com/v1/analytics/campaigns/7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c/time-series?time_range=90d" \
  -H "X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Example response

```json
{
  "timeRange": "90d",
  "interval": "week",
  "data": [
    {
      "period": "May 25",
      "rawPeriod": "2026-05-25",
      "sent": 40,
      "opens": 28,
      "replies": 1,
      "conversions": 0,
      "openRate": 70,
      "replyRate": 2.5,
      "conversionRate": 0,
      "interestedRate": 0,
      "growth": 12.5
    }
  ]
}
```

---

## 4) Campaign replies (actual reply messages)

`GET /v1/analytics/campaigns/:id/replies`

Returns the **inbound reply messages** behind the reply rate — the actual subject/body the lead sent back, with the related lead attached.

> **Reply rate vs. reply content — two different data sources.**
> The reply *rate* in `/performance` is counted from lightweight tracking events (the `email_events` table) and contains **no message text**. The actual reply *content* (subject + body) is stored separately in the `email_replies` table when an inbound reply is ingested (e.g. via SendGrid Inbound Parse). This endpoint reads that content store. As a result, it's possible to see a non‑zero reply *rate* while this endpoint returns fewer rows — replies are only returned here once their full body has been captured and linked to the campaign.

### Path params

| Name | Type | Description |
|------|------|-------------|
| `id` | UUID \| `all` | A campaign id, or `all` to pull replies across every campaign |

### Query params

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | number | `50` | Page size (max `200`) |
| `offset` | number | `0` | Offset for pagination |
| `classification` | string | – | Optional exact filter (e.g. `positive`, `neutral`, `negative`) when replies have been AI-classified |

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `campaign_id` | string | Echoes the requested id (or `all`) |
| `total` | number | Total matching replies (for pagination) |
| `limit` / `offset` | number | Echoes the pagination params |
| `replies` | array | The reply messages, newest first |

Each item in `replies` includes: `id`, `campaign_id`, `lead_id`, `subject`, `text_body`, `html_body`, `from_email` / `sender_email`, `classification`, `message_id`, `in_reply_to`, `reply_ts` / `created_at`, and a nested `lead` object (`id`, `first_name`, `last_name`, `name`, `email`, `title`, `company`, `linkedin_url`, `status`).

### Example request

```bash
curl -s "https://api.thehirepilot.com/v1/analytics/campaigns/7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c/replies?limit=20" \
  -H "X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Example response

```json
{
  "campaign_id": "7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c",
  "total": 1,
  "limit": 20,
  "offset": 0,
  "replies": [
    {
      "id": "f1e2d3c4-...",
      "campaign_id": "7c3f1a2b-7e4d-4b1a-9b2c-1d2e3f4a5b6c",
      "lead_id": "a1b2c3d4-...",
      "subject": "Re: Senior Backend role at Microsoft",
      "text_body": "Thanks for reaching out — happy to chat next week.",
      "html_body": "<p>Thanks for reaching out — happy to chat next week.</p>",
      "from_email": "jane.doe@example.com",
      "classification": "positive",
      "message_id": "msg_abc123",
      "reply_ts": "2026-06-01T15:04:22.000Z",
      "created_at": "2026-06-01T15:04:22.000Z",
      "lead": {
        "id": "a1b2c3d4-...",
        "name": "Jane Doe",
        "email": "jane.doe@example.com",
        "title": "Senior Engineer",
        "company": "Example Inc"
      }
    }
  ]
}
```

> Replies are matched to classic `campaigns` (the ones shown on the Campaign Performance page). For AI **sourcing** campaigns, reply content lives in a separate store; ask if you need that exposed too.

---

## Recipes

### Pull all campaigns and their KPIs (bash)

```bash
API_KEY="hp_live_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE="https://api.thehirepilot.com"

curl -s "$BASE/v1/analytics/campaigns" -H "X-API-Key: $API_KEY" \
  | jq -r '.campaigns[].id' \
  | while read -r id; do
      echo "Campaign $id:"
      curl -s "$BASE/v1/analytics/campaigns/$id/performance" -H "X-API-Key: $API_KEY"
      echo
    done
```

### Fetch one campaign's metrics (Node.js)

```js
const res = await fetch(
  `https://api.thehirepilot.com/v1/analytics/campaigns/${campaignId}/performance`,
  { headers: { 'X-API-Key': process.env.HIREPILOT_API_KEY } }
);
if (!res.ok) throw new Error(`Analytics API ${res.status}: ${await res.text()}`);
const metrics = await res.json();
console.log(metrics.open_rate, metrics.reply_rate);
```

### Push daily metrics to a Google Sheet via Zapier / Make

1. Trigger: **Schedule** (e.g. daily at 8am).
2. Action: **HTTP GET** `https://api.thehirepilot.com/v1/analytics/campaigns/all/performance` with header `X-API-Key`.
3. Map `sent`, `open_rate`, `reply_rate`, `converted_candidates` into your spreadsheet row.

---

## Notes & limits

- **Scope:** data is always limited to the API key's owner (and their team pool when team analytics is enabled). You cannot read another user's campaigns with your key.
- **Definitions match the dashboard.** Metrics are computed from the `email_events` table (`sent`, `open`, `reply`, `conversion`) and deduplicated by message, identical to the in‑app Campaign Performance view.
- **`conversion_rate` vs. the dashboard card:** the API's `conversion_rate` is `conversions / sent`. The dashboard's "Conversion Rate" card instead derives from `converted_candidates / total_leads`; compute that client‑side from the response if you need the card's exact value.
- **Rate of change:** the `time-series` `growth` field is the period‑over‑period change in `sent`.

---

## Quick reference

| Method & path | Purpose |
|---------------|---------|
| `GET /v1/analytics/campaigns` | List campaigns |
| `GET /v1/analytics/campaigns/:id/performance` | Summary KPIs for one campaign |
| `GET /v1/analytics/campaigns/all/performance` | Aggregate KPIs across all campaigns |
| `GET /v1/analytics/campaigns/:id/time-series` | Time‑bucketed metrics for one campaign |
| `GET /v1/analytics/time-series?campaign_id=…` | Time‑bucketed metrics (query‑param form) |
| `GET /v1/analytics/campaigns/:id/replies` | Actual inbound reply messages for a campaign |
