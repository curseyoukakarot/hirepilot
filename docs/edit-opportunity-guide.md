# Public API Guide: Editing & Deleting an Opportunity (Deal)

Update — or delete — an existing HirePilot opportunity over the public API using your `X-API-Key`. This is the canonical follow-up to the [Lead → Client → Opportunity guide](./lead-to-client-to-opportunity-guide.md) and powers the same edits and deletions you make in the in-app **Deals → Opportunities** table (the `/deals` page).

## What this guide covers

1. Editing an opportunity with `PATCH /api/zapier/opportunities/:id` (dollar amount, stage, forecast date, billing terms, tags, etc.).
2. Deleting an opportunity with `DELETE /api/zapier/opportunities/:id` (the trash-icon action in `/deals`).
3. The full list of editable fields, validation, and how to **clear** a field.
4. Common recipes: bump the dollar `value`, move stage, set a forecast date, mark Close Won, delete a deal.
5. Sibling endpoints for things `PATCH` does not cover (status/tag-only updates, notes, stage-only moves) and when to reach for them instead.
6. Errors and how to handle them.
7. End-to-end examples for cURL, Node, Zapier, Make, and REX agents.

> All endpoints below are under the public Zapier router (`/api/zapier/*`) and authenticated by `X-API-Key`. The API key's owning user is the only user who may edit a given opportunity (or a team admin from inside the in-app `/deals` page — that path is **not** exposed here).

---

## Authentication

```http
X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Generate / rotate keys in-app: **Settings → API Keys**.

| Status | Body                                                                              |
|--------|-----------------------------------------------------------------------------------|
| 401    | `{ "error": "Missing X-API-Key header" }` or `{ "error": "Invalid API key" }`     |
| 403    | `{ "error": "Forbidden" }` — the opportunity belongs to another user              |
| 403    | `{ "error": "Forbidden (client)" }` — you sent a `client_id` you don't own        |

---

## Base URL

```
https://api.thehirepilot.com
```

(Replace with your self-hosted backend host where applicable.)

---

## The edit endpoint

`PATCH /api/zapier/opportunities/:id`

Partially updates an existing `opportunities` row owned by the API-key user. Only the fields you include are touched. Send an explicit `null` (or empty string for date/numeric fields) to **clear** a value.

### Path params

| Name | Type | Description                              |
|------|------|------------------------------------------|
| id   | UUID | The `opportunities.id` you want to edit  |

### Body (JSON) — all fields optional

| Field           | Type    | Notes                                                                                                              |
|-----------------|---------|--------------------------------------------------------------------------------------------------------------------|
| `title`         | string  | Must be non-empty when provided.                                                                                   |
| `client_id`     | UUID    | Must reference a `clients` row owned by the same API-key user (otherwise `403 Forbidden (client)`).                |
| `stage`         | string  | Free-form pipeline stage label (e.g. `"Pipeline"`, `"Best Case"`, `"Commit"`, `"Close Won"`).                       |
| `status`        | string  | Lifecycle status: `"open"`, `"won"`, `"lost"`, etc.                                                                 |
| `value`         | number  | **The dollar amount.** Pass `null` to clear.                                                                        |
| `billing_type`  | string  | `"contingency"`, `"retained"`, `"one_time"`, or your own taxonomy. `null` clears.                                   |
| `tag`           | string  | Single tag, e.g. `"rss"`, `"job_seeker"`, `"inbound"`. `null` clears.                                               |
| `forecast_date` | string  | `YYYY-MM-DD` (or ISO timestamp — date portion is stored). `null`/`""` clears.                                       |
| `start_date`    | string  | `YYYY-MM-DD` (or ISO timestamp). `null`/`""` clears.                                                                |
| `term_months`   | number  | Must be one of `1`, `3`, `6`, `12`. `null`/`""` clears.                                                             |
| `margin`        | number  | Numeric margin amount. `null`/`""` clears.                                                                          |
| `margin_type`   | string  | `"currency"` or `"percent"`. `null`/`""` resets to `"currency"`.                                                    |

> **Security:** `owner_id` cannot be changed via this endpoint. Ownership transfers are intentionally not supported over the public API.

### Responses

- `200 OK` — `{ "success": true, "opportunity": { ... } }` (the full updated row)
- `400 Bad Request` — validation error (see table below)
- `403 Forbidden` — you don't own the opportunity, or you sent a `client_id` you don't own
- `404 Not Found` — `:id` doesn't exist
- `500` — DB / unexpected error

#### Validation errors

| Status | Body                                                              | When                                                                  |
|--------|-------------------------------------------------------------------|-----------------------------------------------------------------------|
| 400    | `{ "error": "Missing opportunity id" }`                           | `:id` is empty                                                        |
| 400    | `{ "error": "No editable fields supplied" }`                      | Request body has no recognized fields                                 |
| 400    | `{ "error": "title must be a non-empty string" }`                 | `title` provided but blank                                            |
| 400    | `{ "error": "client_id must be a non-empty UUID" }`               | `client_id` provided but blank                                        |
| 400    | `{ "error": "client_id not found" }`                              | No `clients` row matches the id                                       |
| 400    | `{ "error": "invalid value" }`                                    | `value` not a finite number                                           |
| 400    | `{ "error": "invalid forecast_date" }` / `"invalid start_date"`   | Date not parsable as `YYYY-MM-DD`                                     |
| 400    | `{ "error": "invalid term_months (must be 1, 3, 6, or 12)" }`     | `term_months` not in the allowed set                                  |
| 400    | `{ "error": "invalid margin" }`                                   | `margin` not a finite number                                          |
| 400    | `{ "error": "invalid margin_type (must be \"currency\" or \"percent\")" }` | `margin_type` invalid                                          |
| 401    | Auth error                                                        | Missing/invalid API key                                               |
| 403    | `{ "error": "Forbidden" }`                                        | Opportunity belongs to a different user                               |
| 403    | `{ "error": "Forbidden (client)" }`                               | `client_id` exists but is owned by a different user                   |
| 404    | `{ "error": "Opportunity not found" }`                            | `:id` doesn't exist                                                   |

### Side effects

- Emits an `opportunity_updated` Zap event with `{ before, after, changed_fields }`.
- If the resulting row is in a **Close Won** stage/status **and** `tag` is `Job Seeker` / `job_seeker`, also emits the existing `opportunity_closed_won` workflow event (parity with the in-app `/deals` editor).
- `updated_at` is bumped automatically on every successful call.

Poll either event via:

```
GET /api/zapier/triggers/events?event_type=opportunity_updated&since={ISO}
GET /api/zapier/triggers/events?event_type=opportunity_closed_won&since={ISO}
```

---

## Quickstart — edit the dollar amount of a deal in `/deals`

This is the exact equivalent of opening the row in the `/deals → Opportunities` table, clicking **Edit**, changing `Value`, and saving.

```bash
curl -X PATCH "https://api.thehirepilot.com/api/zapier/opportunities/d40e...91" \
  -H "X-API-Key: $HIREPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "value": 42000 }'
```

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
    "value": 42000,
    "billing_type": "contingency",
    "tag": "inbound",
    "forecast_date": "2026-08-01",
    "start_date": "2026-06-15",
    "term_months": 6,
    "margin": 22.5,
    "margin_type": "percent",
    "created_at": "2026-05-14T17:31:00.000Z",
    "updated_at": "2026-05-24T22:10:00.000Z"
  }
}
```

---

## More recipes

### Move the deal to a new stage

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "stage": "Best Case" }'
```

### Mark Close Won (and trigger the Close Won workflow when tagged Job Seeker)

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "stage": "Close Won", "status": "won", "tag": "job_seeker" }'
```

### Set a new forecast date and term

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "forecast_date": "2026-09-30", "term_months": 12 }'
```

### Switch billing model and margin

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "billing_type": "retained", "margin": 25, "margin_type": "percent" }'
```

### Clear the dollar amount and forecast date

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "value": null, "forecast_date": null }'
```

### Reassign the deal to a different client

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "client_id": "<another-clients.id-you-own>" }'
```

### Rename the deal

```bash
curl -X PATCH "$BASE/api/zapier/opportunities/$OPP_ID" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{ "title": "VP Eng search — Phase 2" }'
```

---

## Deleting an opportunity

`DELETE /api/zapier/opportunities/:id`

The public equivalent of clicking the trash icon on a row in the `/deals → Opportunities` table.

### What it does

1. Owner check — the opportunity must belong to your API-key user (`403 Forbidden` otherwise).
2. Removes any `opportunity_job_reqs` links first (so foreign-key constraints don't trip). The underlying job requisitions themselves are **never** deleted.
3. Deletes the `opportunities` row.
4. Emits an `opportunity_deleted` Zap event containing the full pre-delete snapshot in `payload.opportunity` (so downstream automations can react with full context — title, value, client_id, etc.).

### Path params

| Name | Type | Description                              |
|------|------|------------------------------------------|
| id   | UUID | The `opportunities.id` you want to delete |

### Request

No body. Just the path param + your API key.

```bash
curl -X DELETE "https://api.thehirepilot.com/api/zapier/opportunities/d40e...91" \
  -H "X-API-Key: $HIREPILOT_API_KEY"
```

### Response — `200 OK`

```json
{
  "success": true,
  "id": "d40e...91"
}
```

### Errors

| Status | Body                                       | When                                |
|--------|--------------------------------------------|-------------------------------------|
| 400    | `{ "error": "Missing opportunity id" }`    | `:id` is empty                       |
| 401    | Auth error                                 | Missing/invalid API key              |
| 403    | `{ "error": "Forbidden" }`                 | Opportunity belongs to another user  |
| 404    | `{ "error": "Opportunity not found" }`     | `:id` doesn't exist                  |
| 500    | `{ "error": "..." }`                       | DB / unexpected error                |

### Notes

- **This is destructive and not undoable from the API.** There's no soft-delete or trash bin; the row is gone. If you want a "soft cancel," prefer `PATCH` with `{ "status": "lost" }` or `{ "stage": "Closed Lost" }` instead.
- Deleting an opportunity does **not** delete the linked client, contacts, candidate submissions / applications, notes, or job requisitions.
- Calling `DELETE` again on the same id returns `404` (the second call is a no-op once the row is gone).

---

## Node / TypeScript

```ts
import axios from "axios";

const API = "https://api.thehirepilot.com";
const KEY = process.env.HIREPILOT_API_KEY!;
const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };

export type OpportunityPatch = Partial<{
  title: string;
  client_id: string;
  stage: string;
  status: string;
  value: number | null;
  billing_type: string | null;
  tag: string | null;
  forecast_date: string | null;   // YYYY-MM-DD
  start_date: string | null;      // YYYY-MM-DD
  term_months: 1 | 3 | 6 | 12 | null;
  margin: number | null;
  margin_type: "currency" | "percent";
}>;

export async function editOpportunity(id: string, patch: OpportunityPatch) {
  const { data } = await axios.patch(
    `${API}/api/zapier/opportunities/${id}`,
    patch,
    { headers }
  );
  return data.opportunity; // full updated row
}

// Example: bump the dollar amount and set Close Won
await editOpportunity("d40e...91", {
  value: 65000,
  stage: "Close Won",
  status: "won",
  tag: "job_seeker"
});

export async function deleteOpportunity(id: string) {
  const { data } = await axios.delete(
    `${API}/api/zapier/opportunities/${id}`,
    { headers }
  );
  return data; // { success: true, id }
}
```

---

## Zapier (single-step Zap)

1. **Trigger** — your source (e.g. a row update in Airtable, a Slack approval, a CRM stage change).
2. **Action — Webhooks → Custom Request**:
   - Method: `PATCH`
   - URL: `https://api.thehirepilot.com/api/zapier/opportunities/{{opportunity_id_from_trigger}}`
   - Headers:
     - `X-API-Key: hp_live_…`
     - `Content-Type: application/json`
   - Data (JSON):

```json
{
  "value": {{new_dollar_amount}},
  "stage": "{{new_stage}}",
  "forecast_date": "{{forecast_yyyy_mm_dd}}"
}
```

Only include the keys you actually want to change.

To **delete** a deal from Zapier, swap the action to:
- Method: `DELETE`
- URL: `https://api.thehirepilot.com/api/zapier/opportunities/{{opportunity_id_from_trigger}}`
- Headers: `X-API-Key`
- No body.

---

## Make.com

Mirror the Zapier flow with a single **HTTP → Make a request** module:

- Method: `PATCH`
- URL: `https://api.thehirepilot.com/api/zapier/opportunities/{{1.opportunity_id}}`
- Headers: `X-API-Key`, `Content-Type: application/json`
- Body type: Raw / JSON
- Request content: only the fields you want to update.

---

## REX agent / internal automation

Inside your agent, call `PATCH /api/zapier/opportunities/:id` the same way you call the create endpoint — same `X-API-Key`, same JSON shape. No special agent flag is needed.

```ts
await rex.http.patch(`/api/zapier/opportunities/${oppId}`, {
  value: nextDollarAmount,
  stage: nextStage
});

await rex.http.delete(`/api/zapier/opportunities/${oppId}`);
```

---

## When to use `PATCH` / `DELETE /opportunities/:id` vs. the sibling endpoints

| Goal                                                     | Use this                                                                 | Auth                  |
|----------------------------------------------------------|--------------------------------------------------------------------------|-----------------------|
| Change `value`, `title`, dates, terms, margin, tag, etc. | `PATCH /api/zapier/opportunities/:id`                                    | `X-API-Key`           |
| Remove an opportunity (trash-icon parity)                | `DELETE /api/zapier/opportunities/:id`                                   | `X-API-Key`           |
| Only change `stage` / `status` / `tag` (and emit Close Won workflow on the fly) | `POST /api/zapier/actions/updateOpportunityStatusTag`           | `X-API-Key` *(also accepts HMAC)* |
| Move stage by **stage UUID** (Zapier "moveOpportunityStage") | `POST /api/zapier/actions/moveOpportunityStage`                       | HMAC                  |
| Patch arbitrary columns (legacy / power-user)            | `POST /api/zapier/actions/updateDeal`                                    | HMAC                  |
| Add / update an opportunity **note**                     | `POST /api/zapier/actions/addOrUpdateNote` with `entityType: "opportunity"` | HMAC                  |

For 95% of use cases (including everything an end user does in `/deals`), prefer `PATCH` / `DELETE /api/zapier/opportunities/:id` — single call, full validation, matches the in-app editor field-for-field.

---

## Idempotency

`PATCH` is naturally idempotent at the field level: sending the same payload twice leaves the opportunity in the same state. If you want to gate retries inside your automation (e.g. Zapier replays), wrap the call in your own dedupe key on the source side — there's no server-side `idempotency_key` parameter for `PATCH` because re-issuing the same patch is safe by definition.

`DELETE` is idempotent only in the HTTP sense: the first call returns `200`, every subsequent call on the same id returns `404 Opportunity not found`. If your automation may retry, treat `404` on `DELETE` as success.

---

## Reference

| Endpoint                                                    | Method | Auth        | Purpose                                              |
|-------------------------------------------------------------|--------|-------------|------------------------------------------------------|
| `/api/zapier/opportunities`                                 | POST   | X-API-Key   | Create an opportunity (see [add guide](./lead-to-client-to-opportunity-guide.md)) |
| `/api/zapier/opportunities/:id`                             | GET    | X-API-Key   | Read an opportunity                                  |
| `/api/zapier/opportunities/:id`                             | PATCH  | X-API-Key   | **Edit an opportunity (this guide)**                 |
| `/api/zapier/opportunities/:id`                             | DELETE | X-API-Key   | **Delete an opportunity (this guide)**               |
| `/api/zapier/actions/updateOpportunityStatusTag`            | POST   | X-API-Key / HMAC | Stage / status / tag only + Close Won workflow  |
| `/api/zapier/actions/moveOpportunityStage`                  | POST   | HMAC        | Move to a specific stage UUID                        |
| `/api/zapier/actions/updateDeal`                            | POST   | HMAC        | Arbitrary column patch (legacy)                      |
| `/api/zapier/actions/addOrUpdateNote`                       | POST   | HMAC        | Notes (`entityType: "opportunity"`)                  |
| `/api/zapier/triggers/events?event_type=opportunity_updated`| GET    | X-API-Key   | Poll for edits                                       |
| `/api/zapier/triggers/events?event_type=opportunity_deleted`| GET    | X-API-Key   | Poll for deletions                                   |
| `/api/zapier/triggers/events?event_type=opportunity_closed_won` | GET | X-API-Key | Poll for Close Won + Job Seeker workflow             |

### Implementation pointers (for maintainers)

| Endpoint                                | Handler location (`backend/api/zapierRouter.ts`)  |
|-----------------------------------------|----------------------------------------------------|
| `PATCH  /api/zapier/opportunities/:id`  | `router.patch('/opportunities/:id', ...)`          |
| `DELETE /api/zapier/opportunities/:id`  | `router.delete('/opportunities/:id', ...)`         |
| `POST   /api/zapier/opportunities`      | `router.post('/opportunities', ...)`               |
| `GET    /api/zapier/opportunities/:id`  | `router.get('/opportunities/:id', ...)`            |

- All endpoints use `apiKeyAuth` (`backend/middleware/apiKeyAuth.ts`).
- Ownership is enforced via `opportunities.owner_id = req.user.id` on both the read-before-mutate and the mutate itself.
- When the supplied `client_id` exists but belongs to another user, the handler returns `403 Forbidden (client)` rather than leaking existence.
- `DELETE` removes `opportunity_job_reqs` link rows first (best-effort) to avoid FK constraint errors; it never deletes the underlying job requisitions.
- The in-app `/deals` editor calls the **private** `PATCH /api/opportunities/:id` and `DELETE /api/opportunities/:id` (session JWT, team-admin aware). The public endpoints documented here are the equivalent surface for external automations.
- Event types live in `backend/src/lib/events.ts` (`opportunity_updated`, `opportunity_deleted`, `opportunity_closed_won`).
- See `supabase/migrations/20250920_deals_opportunities.sql` and the follow-up migrations (`20251108_opportunities_tag.sql`, `20251230090000_add_forecast_date_to_opportunities.sql`, `20260111000000_add_opportunity_start_term_margin.sql`, `2026-01-21_add_opportunity_margin_type.sql`) for the table shape.
