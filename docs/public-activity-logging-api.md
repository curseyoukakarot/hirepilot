# Public Activity Logging API (Leads & Candidates)

These endpoints let third-party tools (Zapier, Make, n8n, your own scripts, internal automations) **log activity entries against an existing lead or candidate** using your HirePilot API key. They authenticate via the `X-API-Key` header — no user session required.

> Both endpoints are mounted under the public Zapier router and respect ownership: an API key can only read/write activity for leads/candidates owned by the user that the API key belongs to.

---

## Authentication

- Generate an API key in-app: **Settings → API Keys**.
- Send it on every request as the `X-API-Key` HTTP header.

```http
X-API-Key: hp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

If the key is missing or invalid, you'll get `401 { "error": "Missing X-API-Key header" }` or `401 { "error": "Invalid API key" }`.

If the lead/candidate exists but isn't owned by the API key's user, you'll get `403 { "error": "Forbidden" }`.

---

## Base URL

```
https://api.thehirepilot.com
```

(Replace with your self-hosted backend host, e.g. `https://your-backend.example.com`, when applicable.)

---

## 1) Lead Activity

### 1.1 Log an activity on a lead

`POST /api/zapier/leads/:id/activities`

Logs a row into the `lead_activities` table for the lead `:id`.

#### Path params

| Name | Type   | Description                          |
|------|--------|--------------------------------------|
| id   | UUID   | The `leads.id` you're logging against |

#### Body (JSON)

| Field                | Type        | Required | Description                                                                                  |
|----------------------|-------------|----------|----------------------------------------------------------------------------------------------|
| `activity_type`      | string      | yes      | One of `Call`, `Meeting`, `Outreach`, `Email`, `LinkedIn`, `Note`, `Other`                  |
| `notes`              | string      | no       | Free-text notes / description                                                                |
| `tags`               | string[]    | no       | Tags to attach to this activity entry                                                        |
| `activity_timestamp` | ISO 8601    | no       | When the activity actually occurred. Defaults to the server's current time.                  |

#### Example request

```bash
curl -X POST "https://api.thehirepilot.com/api/zapier/leads/2f6e...c1/activities" \
  -H "X-API-Key: $HIREPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "Call",
    "notes": "Left a voicemail introducing HirePilot.",
    "tags": ["intro-call", "voicemail"],
    "activity_timestamp": "2026-05-14T17:30:00Z"
  }'
```

#### Example response — `201 Created`

```json
{
  "success": true,
  "activity": {
    "id": "9c5b...e4",
    "lead_id": "2f6e...c1",
    "user_id": "8a1c...77",
    "activity_type": "Call",
    "tags": ["intro-call", "voicemail"],
    "notes": "Left a voicemail introducing HirePilot.",
    "activity_timestamp": "2026-05-14T17:30:00.000Z",
    "created_at": "2026-05-14T17:30:01.123Z",
    "updated_at": "2026-05-14T17:30:01.123Z"
  },
  "message": "Call activity logged"
}
```

#### Error responses

| Status | Body                                                                            | When                                  |
|--------|---------------------------------------------------------------------------------|---------------------------------------|
| 400    | `{ "error": "Missing lead id" }`                                                | `:id` is empty                        |
| 400    | `{ "error": "activity_type required" }`                                         | `activity_type` not provided          |
| 400    | `{ "error": "Invalid activity_type. Must be one of: Call, Meeting, ..." }`      | `activity_type` outside allowed list  |
| 400    | `{ "error": "Invalid activity_timestamp" }`                                     | `activity_timestamp` not parseable    |
| 401    | `{ "error": "Missing X-API-Key header" }` / `{ "error": "Invalid API key" }`    | Auth failure                          |
| 403    | `{ "error": "Forbidden" }`                                                      | Lead exists but is owned by another user |
| 404    | `{ "error": "Lead not found" }`                                                 | Lead doesn't exist                    |

### 1.2 List activities for a lead

`GET /api/zapier/leads/:id/activities`

#### Query params

| Name   | Type     | Default | Description                                          |
|--------|----------|---------|------------------------------------------------------|
| `limit`| integer  | 50      | Max rows to return (1–200).                          |
| `since`| ISO 8601 | —       | Only return activities at/after this timestamp.       |

#### Example

```bash
curl "https://api.thehirepilot.com/api/zapier/leads/2f6e...c1/activities?limit=20&since=2026-05-01T00:00:00Z" \
  -H "X-API-Key: $HIREPILOT_API_KEY"
```

#### Response

```json
{
  "lead_id": "2f6e...c1",
  "activities": [
    {
      "id": "9c5b...e4",
      "lead_id": "2f6e...c1",
      "user_id": "8a1c...77",
      "activity_type": "Call",
      "tags": ["intro-call"],
      "notes": "Left a voicemail.",
      "activity_timestamp": "2026-05-14T17:30:00.000Z",
      "created_at": "2026-05-14T17:30:01.123Z",
      "updated_at": "2026-05-14T17:30:01.123Z"
    }
  ]
}
```

---

## 2) Candidate Activity

### 2.1 Log an activity on a candidate

`POST /api/zapier/candidates/:id/activities`

Logs a row into the `candidate_activities` table for the candidate `:id`.

> The underlying `candidate_activities` table currently persists the columns `(candidate_id, job_id, status, notes, created_at, created_by)`. Free-form `activity_type` and `tags` you pass are echoed back in the normalized response payload (matching the lead-activity shape used by the UI), but are not stored in dedicated columns. If you need them durable, persist them inside `notes` or attach a tag to the candidate itself.

#### Path params

| Name | Type | Description                                |
|------|------|--------------------------------------------|
| id   | UUID | The `candidates.id` you're logging against  |

#### Body (JSON)

| Field           | Type     | Required | Description                                                                                                              |
|-----------------|----------|----------|--------------------------------------------------------------------------------------------------------------------------|
| `activity_type` | string   | no       | One of `Call`, `Meeting`, `Outreach`, `Email`, `LinkedIn`, `Note`, `Other`. Defaults to `Note`.                          |
| `notes`         | string   | no\*     | Free-text notes / description.                                                                                          |
| `status`        | string   | no       | One of `sourced`, `contacted`, `interviewed`, `offered`, `hired`, `rejected`. Persisted in the `status` column when set. |
| `tags`          | string[] | no       | Tags to surface in the response (not stored as a separate column on `candidate_activities`).                            |
| `job_id`        | UUID     | no       | Link this activity to a specific `job_requisitions.id` (must be owned by the same user).                                |

\* You must provide at least one of `notes`, `status`, or a non-default `activity_type`. The API rejects empty payloads.

#### Example request

```bash
curl -X POST "https://api.thehirepilot.com/api/zapier/candidates/41d2...9a/activities" \
  -H "X-API-Key: $HIREPILOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_type": "Meeting",
    "notes": "Phone screen completed. Strong on system design.",
    "status": "interviewed",
    "tags": ["phone-screen", "passed"],
    "job_id": "7e6b...ff"
  }'
```

#### Example response — `201 Created`

```json
{
  "success": true,
  "activity": {
    "id": "b1ad...22",
    "candidate_id": "41d2...9a",
    "job_id": "7e6b...ff",
    "activity_type": "Meeting",
    "tags": ["phone-screen", "passed"],
    "status": "interviewed",
    "notes": "Phone screen completed. Strong on system design.",
    "activity_timestamp": "2026-05-14T17:31:42.000Z",
    "created_at": "2026-05-14T17:31:42.000Z",
    "created_by": "8a1c...77",
    "origin": "candidate"
  },
  "message": "Meeting activity logged"
}
```

This endpoint also emits a `candidate_updated` Zap event with `action=activity_logged`, so any Zapier/Make poll on `GET /api/zapier/triggers/events?event_type=candidate_updated` will see the new activity.

#### Error responses

| Status | Body                                                                                          | When                                                |
|--------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------|
| 400    | `{ "error": "Missing candidate id" }`                                                         | `:id` is empty                                      |
| 400    | `{ "error": "Invalid activity_type. Must be one of: Call, Meeting, ..." }`                    | Unknown `activity_type`                             |
| 400    | `{ "error": "Invalid status. Must be one of: sourced, contacted, ..." }`                      | `status` outside the candidate-status enum         |
| 400    | `{ "error": "Provide notes, status, or activity_type to log an activity" }`                   | Empty payload (`activity_type` left as default `Note` and no `notes`/`status`) |
| 400    | `{ "error": "job_id not found" }`                                                             | `job_id` references a missing requisition           |
| 401    | `{ "error": "Missing X-API-Key header" }` / `{ "error": "Invalid API key" }`                  | Auth failure                                        |
| 403    | `{ "error": "Forbidden" }`                                                                    | Candidate exists but belongs to another user        |
| 403    | `{ "error": "Forbidden (job)" }`                                                              | `job_id` belongs to another user                    |
| 404    | `{ "error": "Candidate not found" }`                                                          | Candidate doesn't exist                             |

### 2.2 List activities for a candidate

`GET /api/zapier/candidates/:id/activities`

#### Query params

| Name    | Type     | Default | Description                                                |
|---------|----------|---------|------------------------------------------------------------|
| `limit` | integer  | 50      | Max rows to return (1–200).                                |
| `since` | ISO 8601 | —       | Only return activities created at/after this timestamp.    |
| `job_id`| UUID     | —       | Filter to activities tied to a specific job requisition.   |

#### Example

```bash
curl "https://api.thehirepilot.com/api/zapier/candidates/41d2...9a/activities?limit=50" \
  -H "X-API-Key: $HIREPILOT_API_KEY"
```

#### Response

```json
{
  "candidate_id": "41d2...9a",
  "activities": [
    {
      "id": "b1ad...22",
      "candidate_id": "41d2...9a",
      "job_id": "7e6b...ff",
      "status": "interviewed",
      "notes": "Phone screen completed. Strong on system design.",
      "created_at": "2026-05-14T17:31:42.000Z",
      "created_by": "8a1c...77"
    }
  ]
}
```

### 2.3 Get a single candidate

`GET /api/zapier/candidates/:id`

Companion read endpoint useful when you only have a lead or external identifier and need to confirm ownership before logging activity.

```bash
curl "https://api.thehirepilot.com/api/zapier/candidates/41d2...9a" \
  -H "X-API-Key: $HIREPILOT_API_KEY"
```

```json
{
  "candidate": {
    "id": "41d2...9a",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "email": "ada@example.com",
    "status": "interviewed",
    "lead_id": "2f6e...c1",
    "user_id": "8a1c...77",
    "...": "..."
  }
}
```

---

## 3) Common recipes

### 3.1 Zapier — log a call from your dialer

1. **Trigger**: New call ended in your dialer (e.g. Aircall, RingCentral).
2. **Action — Webhooks → POST**:
   - URL: `https://api.thehirepilot.com/api/zapier/leads/{{lead_id_from_lookup}}/activities`
   - Headers: `X-API-Key: <your key>`, `Content-Type: application/json`
   - Body:

```json
{
  "activity_type": "Call",
  "notes": "{{call_summary}}",
  "tags": ["dialer", "{{call_disposition}}"],
  "activity_timestamp": "{{call_ended_at_iso}}"
}
```

### 3.2 Make.com — flip a candidate to "interviewed" after a Calendly event

1. **Trigger**: Calendly event ended.
2. Lookup candidate by email via `GET /api/zapier/leads?email=...` → cross-walk to candidate id (or store the candidate id on the Calendly invitee question).
3. **HTTP module — POST**:
   - URL: `https://api.thehirepilot.com/api/zapier/candidates/{{candidate_id}}/activities`
   - Header: `X-API-Key: <your key>`
   - Body:

```json
{
  "activity_type": "Meeting",
  "notes": "Interview completed via Calendly. Notes: {{notes}}",
  "status": "interviewed",
  "job_id": "{{job_id_optional}}"
}
```

### 3.3 Internal script (Node)

```ts
import axios from "axios";

const API = "https://api.thehirepilot.com";
const KEY = process.env.HIREPILOT_API_KEY!;

export async function logLeadCall(leadId: string, summary: string) {
  return axios.post(
    `${API}/api/zapier/leads/${leadId}/activities`,
    {
      activity_type: "Call",
      notes: summary,
      tags: ["internal-bot"],
    },
    { headers: { "X-API-Key": KEY } }
  );
}

export async function logCandidateInterview(
  candidateId: string,
  jobId: string,
  notes: string
) {
  return axios.post(
    `${API}/api/zapier/candidates/${candidateId}/activities`,
    {
      activity_type: "Meeting",
      notes,
      status: "interviewed",
      job_id: jobId,
    },
    { headers: { "X-API-Key": KEY } }
  );
}
```

---

## 4) Implementation reference (for maintainers)

| Endpoint                                       | Handler location (`backend/api/zapierRouter.ts`) |
|------------------------------------------------|---------------------------------------------------|
| `GET  /api/zapier/leads/:id/activities`        | `router.get('/leads/:id/activities', ...)`        |
| `POST /api/zapier/leads/:id/activities`        | `router.post('/leads/:id/activities', ...)`       |
| `GET  /api/zapier/candidates/:id/activities`   | `router.get('/candidates/:id/activities', ...)`   |
| `POST /api/zapier/candidates/:id/activities`   | `router.post('/candidates/:id/activities', ...)`  |
| `GET  /api/zapier/candidates/:id`              | `router.get('/candidates/:id', ...)`              |

- All routes use `apiKeyAuth` (`backend/middleware/apiKeyAuth.ts`), which looks up the `api_keys` table on the `X-API-Key` header and attaches `req.user.id`.
- Lead activities table: `lead_activities (lead_id, user_id, activity_type, tags, notes, activity_timestamp, created_at, updated_at)`.
- Candidate activities table: `candidate_activities (candidate_id, job_id, status, notes, created_at, created_by)` — see `supabase/migrations/20240320000000_create_candidate_tables.sql`.
- Logging on a candidate also calls `emitZapEvent({ eventType: 'candidate_updated', eventData: { action: 'activity_logged', ... } })` so existing polling triggers (`/api/zapier/triggers/events?event_type=candidate_updated`) surface it automatically.
