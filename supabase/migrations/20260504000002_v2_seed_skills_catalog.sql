-- HirePilot v2 — Seed the Skills catalog
-- Idempotent: ON CONFLICT DO NOTHING so repeated runs are safe.
-- 30 Skills across 8 specialist roles.

INSERT INTO skills_catalog (id, name, description, category, integration_id, agent_role, icon, schedule_capable) VALUES

-- ===== SOURCER (5 default + 4 add-ons) =====
('linkedin_sourcer',    'LinkedIn Sourcer',    'Scrapes profiles via Sniper.',                            'sourcing',  'linkedin',     'sourcer',           'fa-linkedin',        true),
('apollo_enrich',       'Apollo Enrich',       'Email + phone + firmographics.',                          'sourcing',  'apollo',       'sourcer',           'fa-database',        true),
('icp_researcher',      'ICP Researcher',      'Builds ideal-customer profile from top responders.',     'sourcing',  null,           'sourcer',           'fa-bullseye',        true),
('browser_researcher',  'Browser Researcher',  'Browserbase deep web research.',                          'research',  'browserbase',  'sourcer',           'fa-globe',           false),
('hunter_skill',        'Hunter',              'Email finder + verifier.',                                'sourcing',  'hunter',       'sourcer',           'fa-envelope',        true),
('skrapp_skill',        'Skrapp',              'Email validator.',                                        'sourcing',  'skrapp',       'sourcer',           'fa-shield-check',    true),
('github_sourcer',      'GitHub Sourcer',      'Find devs by code activity.',                             'sourcing',  'github',       'sourcer',           'fa-github',          true),
('twitter_sourcer',     'X / Twitter Sourcer', 'Find people by post signal.',                             'sourcing',  'twitter',      'sourcer',           'fa-twitter',         true),

-- ===== RECRUITER (4 default) =====
('outreach_writer',     'Outreach Writer',     'Drafts personalized first-touches.',                      'engagement','sendgrid',     'recruiter',         'fa-paper-plane',     false),
('reply_handler',       'Reply Handler',       'Drafts responses to incoming replies.',                   'engagement', null,          'recruiter',         'fa-comments',        false),
('submittal_drafter',   'Submittal Drafter',   'Writes candidate writeup for hiring manager.',            'engagement', null,          'recruiter',         'fa-file-lines',      false),
('pipeline_manager',    'Pipeline Manager',    'Moves candidates through stages.',                        'engagement', null,          'recruiter',         'fa-table-columns',   false),

-- ===== COORDINATOR (4 default + 1 alt) =====
('calendar_sync_google','Google Calendar Sync','Reads and writes Google Calendar events.',                'scheduling','google_calendar','coordinator',     'fa-calendar',        false),
('calendar_sync_outlook','Outlook Calendar Sync','Reads and writes Outlook events.',                       'scheduling','outlook',     'coordinator',       'fa-calendar',        false),
('interview_booker',    'Interview Booker',    'Books multi-stakeholder interviews.',                     'scheduling', null,          'coordinator',       'fa-clock',           false),
('reminder_bot',        'Reminder Bot',        'Sends pre-interview reminders to candidates and interviewers.','scheduling', null,    'coordinator',       'fa-bell',            true),
('reschedule_mgr',      'Reschedule Manager',  'Handles candidate reschedule requests.',                  'scheduling', null,          'coordinator',       'fa-rotate',          false),

-- ===== RESEARCHER (3 default) =====
('company_intel',       'Company Intel',       'Deep dive on company / org chart.',                       'research',  'browserbase',  'researcher',        'fa-building',        false),
('comp_benchmark',      'Comp Benchmark',      'Pulls market salary data.',                               'research',  null,           'researcher',        'fa-coins',           false),
('news_watch',          'News Watch',          'Monitors company news + funding signals.',                'research',  null,           'researcher',        'fa-newspaper',       true),

-- ===== BUSINESS DEV (3 default) =====
('hiring_signal_watch', 'Hiring Signal Watch', 'Monitors job boards + funding for new client signals.',  'sourcing',  null,           'business_dev',      'fa-satellite-dish',  true),
('cold_outreach_bd',    'Cold Outreach (BD)',  'Drafts cold outreach to TA leaders + founders.',          'engagement','sendgrid',     'business_dev',      'fa-paper-plane',     false),
('job_board_scrape',    'Job Board Scraper',   'Scans Indeed/LinkedIn/etc. for new openings.',           'sourcing',  'browserbase',  'business_dev',      'fa-list-ul',         true),

-- ===== CLOSER (3 default) =====
('offer_drafter',       'Offer Drafter',       'Drafts offer letters with current comp benchmarks.',     'closing',   null,           'closer',            'fa-file-signature',  false),
('negotiation_coach',   'Negotiation Coach',   'Drafts negotiation talking points.',                      'closing',   null,           'closer',            'fa-comments-dollar', false),
('counter_handler',     'Counter-offer Handler','Drafts responses to candidate counters.',                 'closing',   null,           'closer',            'fa-rotate-left',     false),

-- ===== ACCOUNT MANAGER (3 default) =====
('weekly_reports',      'Weekly Status Reports','Auto-sends client weekly digest.',                       'reporting', 'sendgrid',     'account_manager',   'fa-file-lines',      true),
('pipeline_updater',    'Pipeline Updater',    'Notifies clients on stage moves.',                        'reporting', null,           'account_manager',   'fa-arrow-trend-up',  false),
('renewal_nudge',       'Renewal Nudge',       'Reminds you to nudge renewals before they lapse.',       'reporting', null,           'account_manager',   'fa-bell',            true),

-- ===== REFERENCE CHECKER (3 default) =====
('reference_outreach',  'Reference Outreach',  'Drafts reference request emails.',                        'closing',   'sendgrid',     'reference_checker', 'fa-envelope',        false),
('back_channel',        'Back-channel',        'Drafts back-channel inquiries.',                          'closing',   'sendgrid',     'reference_checker', 'fa-comment-dots',    false),
('reference_synthesis', 'Reference Synthesis', 'Summarizes reference feedback into a 5-line brief.',     'closing',   null,           'reference_checker', 'fa-list-check',      false)

ON CONFLICT (id) DO NOTHING;
