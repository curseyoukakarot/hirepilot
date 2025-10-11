# REX Tools - Quick Commands

This guide lists REX tool commands you can call (via chat or programmatic tool invocation) for the new features shipped in this phase.

## Deals & Zapier Parity Tools

- move_opportunity_stage
  - Params: userId, opportunityId, stageId
  - Effect: Moves an opportunity to a new stage.
  - Example: "REX, move opportunity 123e4567-e89b-12d3-a456-426614174000 to stage 8a8f1f0e-..."

- update_deal
  - Params: userId, dealId, patch
  - Effect: Updates deal fields (title, value, billing_type, status, stage, client_id).
  - Example: "REX, update deal 123... with value 25000 and status active"

- add_or_update_note
  - Params: userId, entityType, entityId, noteId?, body, title?
  - entityType: lead | candidate | decision_maker | opportunity
  - Effect: Adds or updates a note for the target entity.
  - Example: "REX, add a note to candidate 123... titled 'Intro Call' with body 'Great intro'"

- send_invoice
  - Params: userId, clientId, amount, currency?, memo?
  - Effect: Creates an invoice record for the client (Stripe send handled elsewhere).
  - Example: "REX, send invoice to client 123... for $2000 USD memo 'September retainer'"

## Candidate & Pipeline Tools

- move_candidate
  - Params: userId, candidateId, newStage
  - Effect: Moves candidate status across main statuses (sourced → contacted → interviewed → offered → hired/rejected)

- move_candidate_to_stage
  - Params: userId, candidate, stage, jobId?
  - Effect: Moves candidate to a pipeline stage by stage title (resolves candidate by id/email/name)

- update_candidate_notes
  - Params: userId, candidateId, note, author
  - Effect: Adds a note to the candidate (separate from Activity Log)

- view_pipeline
  - Params: userId, jobId, stage?, staleDays?, candidateName?
  - Effect: Returns candidates in pipeline with optional filters

- get_pipeline_stats
  - Params: userId, campaignId, stage
  - Effect: Returns candidate stats for a campaign

## Email & Messaging Tools

- send_message
  - Params: userId, leadId, messageType, tone, jobDetails
  - Effect: Sends a one-off message to a lead (SendGrid)

- send_campaign_email_auto
  - Params: userId, campaign_id, template_name?, subject?, html?, scheduled_for?, channel?
  - Effect: Schedules messages to campaign leads using a template or provided draft

- send_template_email
  - Params: userId, lead, template_name? or template_id?, provider?
  - Effect: Sends a templated email to a single lead

- schedule_bulk_messages
  - Params: userId, leadIds[], templateId, scheduledFor, channel
  - Effect: Queues bulk messages to multiple leads

- get_scheduled_messages, cancel_scheduled_message, get_scheduler_status
  - Inspect, cancel, and view status of scheduled messages

## Sourcing & Enrichment Tools

- source_leads
  - Params: userId, campaignId, source (apollo|linkedin), filters

- filter_leads
  - Params: userId, campaignId?, filters

- enrich_lead, enrich_lead_profile
  - Params: userId, leadId + fields[] OR name/email/linkedinUrl

- get_campaign_lead_count
  - Params: userId, campaignId

## Automation (Zapier/Make) Helpers

- trigger_zapier
  - Params: userId, webhookName, payload

- trigger_make_workflow
  - Params: userId, workflowId, payload

- test_zapier_integration, suggest_automation_workflows, setup_integration_guide, troubleshoot_integration, get_recent_automation_events

## Notes

- All tools respect existing auth/tenant scoping.
- Some tools consume credits (sourcing/enrichment/email). Use `fetch_credits` first if needed.
- For ambiguous names (e.g., candidate by name), REX resolves the best match or asks to disambiguate.
