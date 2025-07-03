-- Table to track which onboarding emails have been sent
create table if not exists trial_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  welcome_sent boolean default false,
  powerup_sent boolean default false,
  expiry_sent boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- trigger to update updated_at
create or replace function set_updated_at_trial_emails() returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end; $$ language plpgsql;

drop trigger if exists trg_trial_emails_updated on trial_emails;
create trigger trg_trial_emails_updated before update on trial_emails
for each row execute function set_updated_at_trial_emails(); 