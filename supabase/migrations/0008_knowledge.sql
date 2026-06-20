-- ============================================================================
-- 0008_knowledge.sql — AI Knowledge / learning layer (Agency OS).
--
-- An org-scoped memory the agents write to and read back, so the platform gets
-- better with use instead of starting cold every time. Two kinds today:
--   * industry_profile — what an industry typically needs (services, highlight
--     topics, FAQ topics, recommended personality, whether it needs a menu),
--     accrued by the Industry Profiler and fed back as guidance for that trade.
--   * winning_pattern  — copy that actually WON an A/B test for an industry+slot,
--     recorded by the Conversion agent and seeded into future experiments.
--
-- Generic key/value so new knowledge kinds need no schema change. Owner-all RLS via
-- my_org_ids(); agents write with the service role. Learning is per-tenant (each
-- agency accrues its own); a cross-org global memory is a later generalisation.
-- ============================================================================

create table if not exists knowledge (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        text not null,                 -- industry_profile | winning_pattern
  key         text not null,                 -- normalised industry, or "industry|slot"
  value       jsonb not null default '{}',
  hits        int not null default 0,        -- how many times this knowledge was reused
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per (org, kind, key) — upserts accrue/refresh it.
create unique index if not exists knowledge_org_kind_key_uniq on knowledge (org_id, kind, lower(key));
create index if not exists knowledge_org_kind_idx on knowledge (org_id, kind, updated_at desc);

drop trigger if exists knowledge_set_updated_at on knowledge;
create trigger knowledge_set_updated_at before update on knowledge
  for each row execute function set_updated_at();

alter table knowledge enable row level security;

drop policy if exists knowledge_owner on knowledge;
create policy knowledge_owner on knowledge
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
