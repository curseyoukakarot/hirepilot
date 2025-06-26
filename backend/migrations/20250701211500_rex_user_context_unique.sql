-- Add unique constraints for upsert to work correctly
alter table rex_user_context
  add constraint rex_uc_supabase unique (supabase_user_id);

alter table rex_user_context
  add constraint rex_uc_slack unique (slack_user_id); 