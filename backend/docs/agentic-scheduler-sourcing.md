## Agentic Scheduler Sourcing — Visibility notes

When a scheduler job runs with `payload.action_tool = "sourcing.run_persona"`, we:

- Insert leads into **`sourcing_leads`** (keyed by `campaign_id` = a `sourcing_campaigns.id`)
- Mirror those leads into the base **`leads`** table for the global `/leads` view
- Tag both tables with **`scheduler_run_id`** so deep-links can filter a single run (`/leads?run_id=...`)

### Where each UI reads from

- **`/agent-mode` → Campaigns (Sourcing Campaigns)**:
  - `GET /api/sourcing/campaigns` → `sourcing_campaigns`
  - Campaign detail (`/agent/campaign/:id`) loads leads from `sourcing_leads` by `campaign_id`

- **`/campaigns` (main)**:
  - Agent-mode “Campaigns” panel also uses `GET /api/sourcing/campaigns` (same `sourcing_campaigns` source)

- **`/leads`**:
  - `GET /api/leads` reads from base `leads`
  - New filter: `GET /api/leads?run_id=<uuid>` → `leads.scheduler_run_id = <uuid>`

### Integration check (expected behavior)

After a scheduler run inserts leads into a sourcing campaign:

- The campaign’s lead count increases in Agent Mode campaigns list (derived from `sourcing_leads`)
- The global `/leads` list shows the same newly-inserted leads (mirrored rows) and supports a run-scoped filter via `run_id`

