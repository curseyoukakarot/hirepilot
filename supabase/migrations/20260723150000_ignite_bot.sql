-- ignite-bot: chatbot lead type, notes column, and the knowledge base table
-- that feeds the assistant's system prompt (edit rows here — no deploy needed).

-- 1. Accept 'events' (intake form) and 'chatbot' (ignite-bot leads)
alter table public.ignite_intake
  drop constraint if exists ignite_intake_form_check;

alter table public.ignite_intake
  add constraint ignite_intake_form_check
  check (form in ('general', 'studio', 'advisory', 'events', 'chatbot'));

-- 2. Free-text context for chatbot-captured leads (question asked, prospectus requests)
alter table public.ignite_intake
  add column if not exists notes text;

-- 3. Knowledge base: every active row is loaded into ignite-bot's prompt,
--    ordered by priority (lower = earlier). Service-role only, like ignite_intake.
create table if not exists public.ignite_bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  title text not null,
  content text not null,
  priority int not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.ignite_bot_knowledge enable row level security;
-- no anon/authenticated policies on purpose: service-role only.

create index if not exists ignite_bot_knowledge_active_idx
  on public.ignite_bot_knowledge (active, priority);

-- 4. Seed content (from ignitegtm.com + the 2026 event prospectuses).
--    Dollar figures are deliberately excluded: ignite-bot never discusses pricing.
insert into public.ignite_bot_knowledge (topic, title, content, priority) values

('company', 'What IgniteGTM is', $$IgniteGTM is the AI-infrastructure events, media, and go-to-market agency behind the AI INFRA SUMMIT series. Tagline: "Charged with Intent." We connect the builders, buyers, and investors powering the next era of AI infrastructure through three divisions: Events (flagship summits, conference activations, bespoke experiences), Ignite Studio (media and video production), and GTM Advisory (go-to-market strategy and activation). Track record: 2,500+ attendees across our events, 50+ partners, and a 40K+ ecosystem of founders, funders, operators, and builders. Partners include NVIDIA, AMD, Supermicro, WEKA, Vultr, Cisco, and Microsoft. Based in San Jose, CA. Site: https://www.ignitegtm.com$$, 10),

('events', 'AI INFRA SUMMIT (flagship)', $$The AI INFRA SUMMIT (AIS) is the premier gathering for AI infrastructure leaders — one venue, one day, zero fluff. Five editions produced; AIS5 brought 1,000+ infrastructure leaders to San Jose. The next edition, AIS6, lands December 4, 2026 in San Jose, CA. What to expect: next-gen innovation and solutions showcase (bleeding-edge AI-native infrastructure — liquid cooling, agentic orchestration, silicon diversity, energy-optimized compute), hard-hitting sessions and strategic panels with leaders from companies like Microsoft, BlackRock, Inflection, and Zscaler, live enterprise use cases, decision-maker-dense networking (CxOs, investors, engineers, policy shapers), an all-day expo hall, and the Infra After Dark afterparty where the deals actually happen. Audience: enterprise, developers, startups, investors, infrastructure providers.$$, 20),

('events', 'NeoCloud Summit', $$NeoCloud Summit — "Where the next cloud gets built." Inaugural edition: October 8, 2026 at the Microsoft Silicon Valley Campus in Mountain View, CA, during SF Tech Week. Thesis: hyperscalers built the cloud; neoclouds are rebuilding it for AI — GPU-as-a-Service is projected to be a $250B+ market by 2030 (ABI Research). The room: 200-250 curated attendees — roughly 30% enterprise infrastructure leaders (CIOs, VPs Infra, cloud architects), 20% neocloud founders and executives, 15% investors and analysts, 15% data-center and energy executives, 15% infrastructure ecosystem (storage, networking, silicon, software), 5% senior developers and architects. Centerpiece: the inaugural NeoCloud Council — 10-12 neocloud CEOs and founders sharing one stage for the first time (target roster includes CoreWeave, Lambda, Nebius, Crusoe, Vultr, NScale, RunPod, Civo, Gcore, Together AI, Genesis Cloud, Voltage Park). Strategic partners: SemiAnalysis (research partner — exclusive Intelligence Briefing on the State of Neocloud Economics) and Infrastructure Masons / iMasons (community partner — "The Foundation Layer" programming track). Founding infrastructure partner archetypes: AMD, Supermicro. Program: keynotes, the State of the NeoCloud panel, sector deep-dives (storage, networking and interconnect), curated networking lunch, closing investor + founder fireside, Gallery happy hour, and an all-day Branded Studio capturing interviews on 8K LED. Venue: 289-seat auditorium with 8K LED walls and cinematic capture.$$, 21),

('events', 'Other event formats', $$Beyond the flagships, IgniteGTM produces: (1) Conference activations — we bring the IgniteGTM engine (content capture, networking programming, brand experiences) into partner conferences and third-party venues; (2) Bespoke experiences — invite-only executive dinners, private roundtables, and custom events built around a sponsor's goals; (3) CXO Roundtables — private half-day thought-leadership events for targeted verticals (50-75 CXO-level attendees, e.g. "AI Transformation for Enterprise"), with end-to-end event production, talk design, speaker curation, and business development support included. Sponsor experiences at flagship events include executive dinners, happy hours, curated lunch tables, branded studio activations, and billboard placements on Hwy 101 near San Jose Airport.$$, 22),

('events', 'Sponsorship — how it works (NO PRICING)', $$Sponsorship tiers exist at multiple levels — from ecosystem-level logo placement up to presenting sponsor with naming rights — with benefits that scale: summit passes, expo tables and demo booths, main-stage speaking slots, breakout sessions and workshops, branded studio interview slots, attendee lists (opt-in), social and newsletter spotlights, swag branding, and sector exclusivity. NeoCloud Summit additionally offers category ownership (one sponsor per category: storage, networking and interconnect, cloud platform, AI software) and NeoCloud Council upgrades. IMPORTANT: never quote prices, tiers' dollar amounts, or fee ranges — every engagement is scoped to the client. When someone asks about sponsorship pricing or packages: collect their name, email, and company via lead capture, note which event they care about, and tell them the team will send over the appropriate prospectus and walk them through options on a call. Do NOT offer prospectus downloads or links.$$, 23),

('studio', 'Ignite Studio', $$Ignite Studio is the media arm of IgniteGTM — "Content that hits different." We don't cover AI infrastructure, we come from it: the same team behind five sold-out AI INFRA SUMMITs. Four pillars: (1) Event Films — cinematic recaps, highlight reels, and social-first cuts that make an event live on for months; (2) Session Capture & Speaker Content — multi-camera keynote and panel capture with speaker-ready deliverables; (3) Executive Interviews & Original Series — standalone studio setups, strategic interviews, and episodic series built around a brand's narrative; (4) Branded Content & Partner Activations — sponsored series, product spotlights, and partner storytelling engineered to travel. The studio also runs all-day Branded Studio activations at IgniteGTM events (8K LED backdrop, professional interviews, short-form social cuts) — including curated guest booking, where we bring strategic accounts to a sponsor's leadership on camera. Portfolio includes sessions with speakers from Google, Fortinet, and the NeoCloud ecosystem. Start a project: https://contact.ignitegtm.com/studio$$, 30),

('advisory', 'GTM Advisory', $$IgniteGTM Advisory — "Your infrastructure has a market. We know how to reach it." Go-to-market strategy and activation for AI infrastructure companies, from positioning to pipeline. We don't advise from the outside; we operate from the center of the ecosystem — we don't study the market, we host it. Four pillars: (1) Technical Positioning & Narrative — messaging that holds up in a skeptical, deeply technical market, from boardroom to main stage; (2) Market Mapping & Buyer Intelligence — ICP definition by stack layer (silicon, compute, data center, software), separating buyers from browsers; (3) Ecosystem Access & Presence — the summits, dinners, and rooms where decisions happen; (4) Strategic Introductions & Business Development — warm introductions to enterprises, partners, and capital, built from five years inside the rooms that matter (relationships spanning AMD, Supermicro, Tencent, Microsoft, BlackRock, Crusoe, and more). Talk strategy: https://contact.ignitegtm.com/advisory$$, 40),

('team', 'The team', $$IgniteGTM is led by its front-of-house team: Bill Barry (Co-Founder & CEO — producer behind the AI INFRA SUMMIT series), Brandon Omoregie (Co-Founder, President & Head of Operations), Ylla Chavez (Project Manager), Logan Lemrey (Head of Content), and Ned Lansing (Venue Manager) — backed by a full crew of producers, editors, and operators. Primary contact for events and sponsorship: Bill Barry, bill@ignitegtm.com. General inbox: hello@ignitegtm.com.$$, 50),

('contact', 'Contact routes & booking', $$Intake forms (send people to the right one): General — https://contact.ignitegtm.com/ ; Events (sponsor AIS6, speak, request an invite, partnership, media/press) — https://contact.ignitegtm.com/events ; Studio projects — https://contact.ignitegtm.com/studio ; Advisory — https://contact.ignitegtm.com/advisory . Book a 30-minute intro call with Bill Barry: https://calendly.com/ignitegtm/meeting-30m-with-bill-barry . Email: hello@ignitegtm.com. The main site is https://www.ignitegtm.com (events, studio, advisory, and team pages).$$, 60),

('policy', 'Boundaries & escalation', $$Rules: (1) NEVER discuss pricing, fees, budgets, or dollar amounts for anything — sponsorships, studio work, or advisory. Every client situation is different; capture contact details and route to the team instead. (2) Never share, link, or offer the sponsorship prospectus documents — the team sends those directly after contact capture. (3) If asked something outside IgniteGTM's world (legal, tax, deep vendor comparisons), be honest that it's outside scope and offer the intro call. (4) When a visitor asks for a human, seems high-value (sponsor, enterprise buyer, press), or gets frustrated — route to live chat so the team is pinged in Slack, and offer the Calendly link. (5) Stay grounded in this knowledge base; if you don't know, say so and offer the call — never invent details, dates, or names.$$, 70);
