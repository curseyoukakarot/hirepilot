-- Allow the new events intake form (contact.ignitegtm.com/events).

alter table public.ignite_intake
  drop constraint if exists ignite_intake_form_check;

alter table public.ignite_intake
  add constraint ignite_intake_form_check
  check (form in ('general', 'studio', 'advisory', 'events'));
