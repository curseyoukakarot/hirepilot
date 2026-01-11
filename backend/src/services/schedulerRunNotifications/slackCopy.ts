// IMPORTANT: This file contains the exact Slack notification copy requested.
// Placeholders follow the {{var}} and {{#if var}} ... {{else}} ... {{/if}} conventions.

export const SLACK_SUCCESS_TEMPLATE = `✅ Scheduler Run Complete — {{schedule_name}}

Persona: {{persona_name}}
Attempts: {{attempts_used}}/4 · Quality: {{quality_score}}/100 (conf {{confidence}})

Results
• Leads found: {{found_count}}
• Added: {{inserted_count}} ({{deduped_count}} deduped)
• Email coverage: {{email_coverage_pct}}% {{email_coverage_label}}
• Geo match: {{geo_match_pct}}% · Title match: {{title_match_pct}}%

Outreach
{{#if outreach_enabled}}
• Step 1: Queued {{outreach_queued_count}}
• Mode: {{outreach_mode_label}} {{#if delay_hours}}(after {{delay_hours}}h){{/if}}
• Daily cap: {{daily_send_cap_label}}
{{else}}
• Step 1: Not enabled for this schedule
{{/if}}

Next run: {{next_run_at_human}}

Buttons
	•	View in Agent Mode → {{agent_mode_url}}
	•	View Campaign → {{campaign_url}}
	•	View Leads → {{leads_url}}`;

export const SLACK_LOW_RESULTS_TEMPLATE = `⚠️ Scheduler Run Complete — Low Volume: {{schedule_name}}

Persona: {{persona_name}}
Attempts: {{attempts_used}}/4 · Quality: {{quality_score}}/100 (conf {{confidence}})

Results
• Leads found: {{found_count}}
• Added: {{inserted_count}} ({{deduped_count}} deduped)

Note
This run came back light. If you want, I can broaden the search next run (e.g., {{suggested_expansion_preview}}).

Next run: {{next_run_at_human}}

Buttons
	•	View Leads → {{leads_url}}
	•	View Campaign → {{campaign_url}}
	•	Adjust Schedule → {{schedule_settings_url}}`;

export const SLACK_ACTION_NEEDED_TEMPLATE = `🛑 Scheduler Needs Input — {{schedule_name}}

Persona: {{persona_name}}
Attempts: {{attempts_used}}/4 · Quality: {{quality_score}}/100 (conf {{confidence}})

What happened
• Leads found: {{found_count}}
• Added: {{inserted_count}}
• Primary issue: {{failure_mode_label}}
• Why: {{failure_reason_short}}

Recommended fix
{{recommended_fix_summary}}

Buttons
	•	✅ Approve Suggested Expansion → {{approve_expansion_url}}
	•	↩️ Keep Criteria (try again next run) → {{keep_criteria_url}}
	•	View Schedule → {{schedule_settings_url}}`;

