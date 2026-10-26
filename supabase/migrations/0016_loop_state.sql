-- 0016_loop_state.sql — Goal Engine bookkeeping (Agency OS "empire" layer).
--
-- A tiny key-value store the autonomous loops use to remember their own state
-- across ticks: last operator-digest send time, weekly funnel snapshots for
-- trend lines on the Briefing page. Service-role only (RLS denies everyone but
-- the owner policies below keep admin reads working via my_org_ids()).
--
-- Graceful degradation: until this is applied, digest + snapshots are inert —
-- the loops run exactly as before.

create table if not exists loop_state (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

create index if not exists loop_state_org_idx on loop_state (org_id, key);

alter table loop_state enable row level security;

drop policy if exists loop_state_owner on loop_state;
create policy loop_state_owner on loop_state
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
