-- ============================================================================
-- 0002_agency_os.sql — Agent substrate (Phase A of the Agency OS).
--
-- Adds the shared machinery every AI agent runs on: an audit + cost trail
-- (agent_runs), a durable job queue (jobs), per-org autonomy + spend caps
-- (agent_settings), a daily AI cost rollup (ai_cost_ledger) and a human-in-the-
-- loop gate (approvals). See docs/AGENCY_OS.md §3.
--
-- These tables are written by server-side machinery (the agent runner / job
-- worker) using the service-role key, so they have no public-read policy. The
-- owner RLS policies exist so the admin UI (anon key + user JWT) can READ its
-- own org's rows for the Agent Control Centre. All scoping reuses my_org_ids()
-- from 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- AGENT_RUNS — one row per agent execution. The audit + cost trail.
-- ----------------------------------------------------------------------------
create table if not exists agent_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  kind          text not null,                       -- AgentKind (discovery|design|...)
  status        text not null default 'running',     -- running|completed|awaiting_approval|blocked|skipped|failed
  autonomy      text not null default 'suggest',     -- off|suggest|approve|auto (resolved at run time)
  input         jsonb,
  output        jsonb,
  summary       text,
  model         text,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_pence    int not null default 0,
  error         text,
  actor_user_id uuid,                                -- null = autonomous/cron
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists agent_runs_org_created_idx on agent_runs (org_id, created_at desc);
create index if not exists agent_runs_kind_idx on agent_runs (org_id, kind, created_at desc);

-- ----------------------------------------------------------------------------
-- JOBS — durable queue. Polled by /api/jobs/tick (Vercel Cron). Swap for a real
-- queue later behind lib/jobs/queue.ts's enqueue() — same as the rate-limiter's
-- Upstash note.
-- ----------------------------------------------------------------------------
create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        text not null,                         -- AgentKind to run
  payload     jsonb,
  status      text not null default 'queued',        -- queued|running|done|failed
  attempts    int not null default 0,
  max_attempts int not null default 3,
  run_after   timestamptz not null default now(),
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- The worker claims due, queued jobs oldest-first.
create index if not exists jobs_due_idx on jobs (status, run_after) where status = 'queued';
create index if not exists jobs_org_idx on jobs (org_id, created_at desc);

-- ----------------------------------------------------------------------------
-- AGENT_SETTINGS — per-org, per-agent autonomy + spend caps. Absent row = the
-- agent definition's defaults (see lib/agents).
-- ----------------------------------------------------------------------------
create table if not exists agent_settings (
  org_id            uuid not null references orgs(id) on delete cascade,
  kind              text not null,                   -- AgentKind
  autonomy          text not null default 'suggest', -- off|suggest|approve|auto
  daily_cap_pence   int,                             -- null = inherit org default
  monthly_cap_pence int,
  updated_at        timestamptz not null default now(),
  primary key (org_id, kind)
);

-- ----------------------------------------------------------------------------
-- AI_COST_LEDGER — daily rollup per org. Source of truth for spend caps and the
-- cost view in the Agent Control Centre.
-- ----------------------------------------------------------------------------
create table if not exists ai_cost_ledger (
  org_id     uuid not null references orgs(id) on delete cascade,
  day        date not null default current_date,
  cost_pence int not null default 0,
  run_count  int not null default 0,
  primary key (org_id, day)
);
create index if not exists ai_cost_ledger_org_idx on ai_cost_ledger (org_id, day desc);

-- Atomic upsert of a day's spend (called after every AI call). Runs as service
-- role; defined here so the increment is a single round-trip.
create or replace function add_ai_cost(p_org uuid, p_cost int, p_runs int default 0)
returns void language sql as $$
  insert into ai_cost_ledger (org_id, day, cost_pence, run_count)
  values (p_org, current_date, greatest(p_cost, 0), greatest(p_runs, 0))
  on conflict (org_id, day) do update
    set cost_pence = ai_cost_ledger.cost_pence + greatest(p_cost, 0),
        run_count  = ai_cost_ledger.run_count  + greatest(p_runs, 0);
$$;

-- ----------------------------------------------------------------------------
-- APPROVALS — human-in-the-loop gate. An agent run with autonomy 'approve'
-- parks its proposed action here until an operator approves/rejects it.
-- ----------------------------------------------------------------------------
create table if not exists approvals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  agent_run_id uuid references agent_runs(id) on delete cascade,
  kind         text not null,                        -- AgentKind
  summary      text not null,
  payload      jsonb,                                -- the proposed action to apply
  status       text not null default 'pending',      -- pending|approved|rejected
  decided_by   uuid,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists approvals_org_status_idx on approvals (org_id, status, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at touch triggers.
-- ----------------------------------------------------------------------------
drop trigger if exists jobs_set_updated_at on jobs;
create trigger jobs_set_updated_at before update on jobs
  for each row execute function set_updated_at();

drop trigger if exists agent_settings_set_updated_at on agent_settings;
create trigger agent_settings_set_updated_at before update on agent_settings
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — owner-read, scoped via my_org_ids() (from 0001). Writes
-- come from the service role (runner / worker), which bypasses RLS.
-- ============================================================================
alter table agent_runs     enable row level security;
alter table jobs           enable row level security;
alter table agent_settings enable row level security;
alter table ai_cost_ledger enable row level security;
alter table approvals      enable row level security;

drop policy if exists agent_runs_owner on agent_runs;
create policy agent_runs_owner on agent_runs
  for select using (org_id in (select my_org_ids()));

drop policy if exists jobs_owner on jobs;
create policy jobs_owner on jobs
  for select using (org_id in (select my_org_ids()));

-- Settings are the one table an operator edits directly from the dashboard.
drop policy if exists agent_settings_owner on agent_settings;
create policy agent_settings_owner on agent_settings
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

drop policy if exists ai_cost_ledger_owner on ai_cost_ledger;
create policy ai_cost_ledger_owner on ai_cost_ledger
  for select using (org_id in (select my_org_ids()));

-- Operators read approvals and update their status (approve/reject) from the UI.
drop policy if exists approvals_owner on approvals;
create policy approvals_owner on approvals
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
