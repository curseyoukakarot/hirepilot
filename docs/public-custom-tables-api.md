# Public Custom Tables API (Recruiting)

These endpoints let third-party tools (Zapier/Make/your own scripts) **append leads directly into an existing HirePilot custom table** and **poll for table changes**.

## Authentication

- Provide your user API key via the `X-API-Key` header.
- API keys are managed in-app (Settings → API Keys).

## 1) Append leads to an existing table (by table name)

**POST** `https://api.thehirepilot.com/api/public/tables/append-leads`

### Requirements
- `table_name` **must already exist** for that user.
- This endpoint **does not write to** `/leads` (it appends into `custom_tables.data_json`).

### Body (single lead)

```json
{
  "table_name": "My Leads Table",
  "lead": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "company": "Analytical Engines Inc",
    "title": "Engineer",
    "linkedin_url": "https://www.linkedin.com/in/ada",
    "location": "London",
    "source": "Zapier",
    "tags": ["vip", "conference-2026"],
    "status": "New"
  }
}
```

### Body (bulk)

```json
{
  "table_name": "My Leads Table",
  "leads": [
    { "name": "Ada Lovelace", "email": "ada@example.com" },
    { "name": "Grace Hopper", "email": "grace@example.com" }
  ]
}
```

## 2) Poll for table changes (Zapier-friendly)

**GET** `https://api.thehirepilot.com/api/public/tables/poll?table_name=My%20Leads%20Table&since=2026-01-01T00:00:00.000Z`

- Returns `changed: true` if `updated_at` is newer than `since`.
- Use this as a Zapier “Polling Trigger”.


