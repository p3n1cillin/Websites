-- ============================================================================
-- 0007_workflows.sql — Workflow engine (Phase H of the Agency OS).
--
-- Wires the ten agents into automated pipelines: a `workflow` is an ordered list
-- of agent steps (stored in `steps` jsonb); a `workflow_run` is one execution over
-- a seed context (e.g. a prospect), threading each agent's output into the next.
-- The engine (lib/workflow-engine.ts) runs steps through the existing agent runner,
-- so every step is still audited, cost-tracked and autonomy-gated.
--
-- (docs §5 sketched `graph jsonb`; we ship a LINEAR step list first — branching/DAG
-- is a later generalisation behind the same tables.)
--
-- Owner-all RLS via my_org_ids(); the engine reads/writes with the service role.
-- ============================================================================

create table if not exists workflows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  name        text not null,
  steps       jsonb not null default '[]',  -- [{id, kind, autonomy, config}]
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workflows_org_idx on workflows (org_id, created_at desc);

drop trigger if exists workflows_set_updated_at on workflows;
create trigger workflows_set_updated_at before update on workflows
  for each row execute function set_updated_at();

alter table workflows enable row level security;

drop policy if exists workflows_owner on workflows;
create policy workflows_owner on workflows
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

-- ---------------------------------------------------------------------------
-- workflow_runs — one execution of a workflow over a seed context.
-- ---------------------------------------------------------------------------
create table if not exists workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  workflow_id  uuid not null references workflows(id) on delete cascade,
  status       text not null default 'running', -- running|completed|failed|paused
  step         int not null default 0,           -- current/last step index
  context      jsonb not null default '{}',      -- threaded entity refs + outputs
  log          jsonb not null default '[]',      -- [{index, kind, status, summary, error, costPence}]
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists workflow_runs_workflow_idx on workflow_runs (workflow_id, created_at desc);
create index if not exists workflow_runs_org_idx on workflow_runs (org_id, created_at desc);

alter table workflow_runs enable row level security;

drop policy if exists workflow_runs_owner on workflow_runs;
create policy workflow_runs_owner on workflow_runs
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
