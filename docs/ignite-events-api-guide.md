# Ignite Events API — Connect & Upload Events

This guide explains how a **person** or an **AI agent** can connect to the Ignite
client app (`clients.ignitegtm.com`) using an API key and upload events, then turn
any event into a draft proposal in one click.

- **Base URL:** `https://api.thehirepilot.com`
- **Auth header:** `x-api-key: <YOUR_KEY>`
- **Content type:** `application/json`

> All event endpoints are scoped to the Ignite team account that owns the API key.
> A key only works for accounts with the `ignite_admin` or `ignite_team` role.

---

## 1. Get an API key

1. Sign in to `https://clients.ignitegtm.com`.
2. In the left sidebar, open **Settings → API Keys**.
3. (Optional) Give the key a label (e.g. `Zapier`, `n8n agent`, `Make.com`).
4. Click **Generate Key** and **copy it immediately** — the full key is shown only once.
5. Store it as a secret in your tool/agent. You can revoke a key anytime from the same page.

Keys look like `ignite_live_xxxxxxxx...` (production) or `ignite_test_xxxxxxxx...` (non‑prod).

### Authenticating

Send the key on every request as the `x-api-key` header:

```bash
curl https://api.thehirepilot.com/api/ignite/events \
  -H "x-api-key: ignite_live_xxxxxxxx..."
```

A missing/invalid key returns `401`. A key that belongs to a non‑Ignite account returns `403 ignite_access_denied`.

---

## 2. What is an event? (datapoints)

An event is the core record you upload. These are the fields the API accepts:

| Field                 | Type                                              | Required | Notes |
|-----------------------|---------------------------------------------------|:--------:|-------|
| `name`                | string                                            | ✅       | Event name. Defaults to `"Untitled Event"` if omitted. |
| `kind`                | `"internal"` \| `"external"`                      |          | `internal` = hosted by Ignite, `external` = client event. Default `internal`. |
| `status`              | `"draft"` \| `"planning"` \| `"live"` \| `"closed"` |        | Default `draft`. |
| `client_id`           | uuid                                              |          | Link to an existing Ignite client. |
| `client_name_override`| string                                            |          | Display name when there is no `client_id` yet. (`client_name` also accepted) |
| `start_date`          | date `YYYY-MM-DD`                                 |          | |
| `end_date`            | date `YYYY-MM-DD`                                 |          | |
| `city`                | string                                            |          | |
| `venue`               | string                                            |          | |
| `headcount`           | integer                                           |          | Expected attendees. Default `0`. |
| `primary_contact`     | string                                            |          | Main point of contact. |
| `owner_name`          | string                                            |          | Internal owner. |
| `description`         | string                                            |          | Becomes the proposal "objective" on conversion. |
| `target_margin_pct`   | number                                            |          | Default `20`. |
| `metadata_json`       | object                                            |          | Free‑form extra data. |

An event can also have **sponsors** and **cost lines** (added via separate endpoints below):

- **Sponsor:** `name` (required), `kind` (`cash` \| `in_kind`), `amount`, `status` (`prospect` \| `committed` \| `invoiced` \| `paid`), `contact`, `notes`, `referral_owner`, `referral_percent`.
- **Cost line:** `category`, `description` (required), `vendor`, `qty`, `unit_cost`, `status` (`budgeted` \| `committed` \| `invoiced` \| `paid`), `notes`.

---

## 3. Upload an event

### Create

```bash
curl -X POST https://api.thehirepilot.com/api/ignite/events \
  -H "x-api-key: $IGNITE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q3 Partner Summit",
    "kind": "external",
    "status": "planning",
    "start_date": "2026-09-12",
    "end_date": "2026-09-12",
    "city": "Austin, TX",
    "venue": "Fairmont Austin",
    "headcount": 250,
    "primary_contact": "Jane Doe",
    "owner_name": "Ignite Team",
    "description": "Annual partner summit with keynote + breakout tracks.",
    "target_margin_pct": 25
  }'
```

Response: `201` with `{ "event": { "id": "...", ... } }`. Keep the `event.id`.

### List

```bash
curl https://api.thehirepilot.com/api/ignite/events \
  -H "x-api-key: $IGNITE_API_KEY"
```

Returns `{ "events": [ { ...event, "totals": { cash_revenue, total_costs, margin, ... } } ] }`.

### Update / fetch one

```bash
# Fetch a single event bundle (event + sponsors + costs + documents + totals)
curl https://api.thehirepilot.com/api/ignite/events/<EVENT_ID> -H "x-api-key: $IGNITE_API_KEY"

# Patch fields
curl -X PATCH https://api.thehirepilot.com/api/ignite/events/<EVENT_ID> \
  -H "x-api-key: $IGNITE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "status": "live", "headcount": 300 }'
```

### Add sponsors / costs

These endpoints **replace** the full list for the event:

```bash
curl -X PUT https://api.thehirepilot.com/api/ignite/events/<EVENT_ID>/sponsors \
  -H "x-api-key: $IGNITE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "sponsors": [
        { "name": "Acme Corp", "kind": "cash", "amount": 50000, "status": "committed" },
        { "name": "Globex", "kind": "in_kind", "amount": 8000, "status": "prospect" }
      ] }'

curl -X PUT https://api.thehirepilot.com/api/ignite/events/<EVENT_ID>/costs \
  -H "x-api-key: $IGNITE_API_KEY" -H "Content-Type: application/json" \
  -d '{ "costs": [
        { "category": "Venue", "description": "Ballroom rental", "qty": 1, "unit_cost": 18000, "status": "budgeted" },
        { "category": "F&B", "description": "Catering", "qty": 250, "unit_cost": 85, "status": "budgeted" }
      ] }'
```

---

## 4. Convert an event → draft proposal (one click)

Turn any event into a draft proposal. The event's basic parameters (venue, city,
date, headcount, sponsors, description) pre‑fill the proposal, and each event cost
line becomes a proposal line item.

**If the event has no client, a new client is auto‑created** (named after the event /
`client_name_override`) and linked back to the event.

### In the app
Open an event → click **Convert to Proposal**. You land in the proposal wizard with
everything pre‑filled, ready to button up for the client.

### Via the API

```bash
curl -X POST https://api.thehirepilot.com/api/ignite/events/<EVENT_ID>/convert-to-proposal \
  -H "x-api-key: $IGNITE_API_KEY" -H "Content-Type: application/json"
```

Response `201`:

```json
{
  "proposal": { "id": "...", "status": "draft", "client_id": "...", "name": "Q3 Partner Summit" },
  "proposal_id": "...",
  "client_id": "...",
  "created_client": true,
  "line_items_count": 2
}
```

Open the draft in the app to finish editing:
`https://clients.ignitegtm.com/ignite/proposals/new?proposalId=<proposal_id>&step=1`

---

## 5. Agent recipe (end‑to‑end)

A typical autonomous flow for an AI agent:

1. **Create the event** → `POST /api/ignite/events` → capture `event.id`.
2. **Attach money** (optional) → `PUT /api/ignite/events/{id}/sponsors` and `PUT /api/ignite/events/{id}/costs`.
3. **Convert to a proposal** → `POST /api/ignite/events/{id}/convert-to-proposal` → capture `proposal_id`.
4. **Hand off to a human** with the wizard URL above to finalize pricing and send.

```bash
EVENT_ID=$(curl -s -X POST https://api.thehirepilot.com/api/ignite/events \
  -H "x-api-key: $IGNITE_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Founder Dinner","kind":"external","city":"NYC","headcount":40}' \
  | jq -r '.event.id')

curl -s -X POST https://api.thehirepilot.com/api/ignite/events/$EVENT_ID/convert-to-proposal \
  -H "x-api-key: $IGNITE_API_KEY" | jq '.proposal_id'
```

---

## 6. Errors

| Status | Meaning |
|-------:|---------|
| `400`  | Bad input (e.g. `name_required`). |
| `401`  | Missing/invalid `x-api-key`. |
| `403`  | Key’s account lacks Ignite access (`ignite_access_denied` / `ignite_team_required`). |
| `404`  | Event/proposal not found. |
| `500`  | Server error (message in `error`). |

## 7. Endpoint reference

| Method & path | Purpose |
|---|---|
| `GET /api/ignite/api-keys` | List your keys (masked) |
| `POST /api/ignite/api-keys` | Mint a key (`{ "name": "..." }`) — returns full key once |
| `DELETE /api/ignite/api-keys/:id` | Revoke a key |
| `GET /api/ignite/events` | List events with totals |
| `POST /api/ignite/events` | Create event |
| `GET /api/ignite/events/:id` | Get event bundle |
| `PATCH /api/ignite/events/:id` | Update event |
| `DELETE /api/ignite/events/:id` | Archive (status → closed) |
| `PUT /api/ignite/events/:id/sponsors` | Replace sponsors |
| `PUT /api/ignite/events/:id/costs` | Replace cost lines |
| `POST /api/ignite/events/:id/convert-to-proposal` | Create draft proposal (auto‑creates client) |
