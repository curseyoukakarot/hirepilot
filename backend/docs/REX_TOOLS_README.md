# REX Tools and Automation API

This document lists the primary categories and endpoints exposed for automation via HTTP and MCP.

## Event Feed
- GET /api/zapier/triggers/event-types — list supported event types and descriptions
- GET /api/zapier/triggers/events?event_type=...&since=...&limit=...&cursor=...

Example:
```
curl "${BACKEND_URL}/api/zapier/triggers/events?event_type=opportunity_submitted&since=2024-01-01T00:00:00Z" -H "X-API-Key: <key>"
```

## REX Tools HTTP Surface (requires Bearer user JWT)
Base: /api/rex/tools (rate limited, supports Idempotency-Key)

### Opportunity
- POST /opportunity/submit-to-client { opportunityId, candidateId, message? }
- POST /opportunity/notes { opportunityId, text }
- POST /opportunity/collaborators { opportunityId, email, role? }

### Messaging
- POST /messaging/bulk-schedule { template_id, lead_ids[], scheduled_at, sender }
- POST /messaging/schedule-mass { messages: [...] }

### Sourcing
- POST /sourcing/relaunch { campaignId }
- POST /sourcing/schedule { campaignId }
- POST /sourcing/stats { campaignId, emit? }

### Enrichment
- POST /enrichment/lead { leadId }
- POST /enrichment/candidate { candidateId }

### CRM
- POST /crm/client { name, domain? }
- POST /crm/client/update { id, update }
- POST /crm/client/enrich { id }
- POST /crm/contact { client_id, email, name?, title? }

### Billing / Credits / Invoices
- POST /billing/credits/purchase { packageId }
- POST /billing/checkout {}
- POST /billing/cancel {}
- POST /billing/invoice { client_id, amount, ... }

### Team / Notifications
- POST /team/invite { email, role? }
- POST /team/role { memberId, role }
- POST /notifications/create { title?, body?, type? }

### Sniper
- POST /sniper/targets { url, opener? }
- POST /sniper/capture-now { targetId }

## MCP Tool Keys
- opportunity.submitToClient, opportunity.addNote, opportunity.addCollaborator
- messaging.bulkSchedule, messaging.scheduleMassMessage
- sourcing.relaunch, sourcing.schedule, sourcing.stats
- enrichment.lead, enrichment.candidate
- crm.clientCreate, crm.clientUpdate, crm.clientEnrich, crm.contactCreate
- billing.purchaseCredits, billing.checkout, billing.cancel, billing.invoiceCreate
- team.invite, team.updateRole
- notifications.create
- sniper.addTarget, sniper.captureNow
- linkedin.connect

## Examples
Submit candidate:
```
curl -X POST "$BACKEND_URL/api/rex/tools/opportunity/submit-to-client" \
 -H "Authorization: Bearer $USER_JWT" -H 'Content-Type: application/json' \
 -d '{"opportunityId":"op_123","candidateId":"cand_456","message":"For review"}'
```
Bulk schedule:
```
curl -X POST "$BACKEND_URL/api/rex/tools/messaging/bulk-schedule" \
 -H "Authorization: Bearer $USER_JWT" -H 'Content-Type: application/json' \
 -d '{"template_id":"tmpl_1","lead_ids":["l1","l2"],"scheduled_at":"2025-01-10T15:00:00Z","sender":{"provider":"sendgrid"}}'
```
