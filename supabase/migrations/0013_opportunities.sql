-- ============================================================================
-- 0013_opportunities.sql — Tracked ventures (Autonomous Opportunity Execution).
--
-- An `opportunity` is a catalog idea (lib/empire) that the owner has chosen to
-- PURSUE — it's now tracked through the lifecycle (validation → planning → asset
-- creation → deployment → monetization → optimization → scaling → live) with a
-- viability score and the single next concrete action. Opportunities stop being
-- ideas: each row is a venture being moved toward revenue.
--
-- Org-scoped; written/read SERVER-SIDE via the service role. Best-effort in the app
-- layer — a missing table just means "no active ventures yet" (catalog still works).
-- ============================================================================

create table if not exists opportunities (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  ref             text,
  title           text not null,
  category        text not null,
  stage           text not null default 'validation'
                  check (stage in ('validation','planning','asset_creation','deployment','monetization','optimization','scaling','live')),
  viability_score int not null default 0,
  recurring_pence int not null default 0,
  next_action     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists opportunities_org_idx on opportunities (org_id);
-- One tracked venture per catalog ref per org (pursue is idempotent on this).
create unique index if not exists opportunities_org_ref_uniq
  on opportunities (org_id, ref) where ref is not null;

drop trigger if exists opportunities_set_updated_at on opportunities;
create trigger opportunities_set_updated_at before update on opportunities
  for each row execute function set_updated_at();

alter table opportunities enable row level security;

drop policy if exists opportunities_owner on opportunities;
create policy opportunities_owner on opportunities
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
