-- ============================================================================
-- 0006_experiments.sql — Growth loops: A/B experiments (Phase G of the Agency OS).
--
-- The Conversion Optimiser agent (6) runs headline/CTA A/B tests on LIVE customer
-- sites. One `experiments` row per test holds its variants (control + candidates)
-- with rolling impression/conversion counters in jsonb. The public site assigns a
-- visitor a variant client-side (SSG-safe — the page still pre-renders the control)
-- and the /api/experiments/* routes record impressions + conversions server-side.
--
-- Owner-all RLS via my_org_ids() (operators manage from /admin/growth). The public
-- read (active experiment) + counter writes go through the service role in the API
-- routes — no anon policy, same capability model as 0004/0005.
--
-- Counters are read-modify-write at the app layer (impressions are deduped per
-- visitor client-side, conversions are rare), which is fine at local-business
-- traffic; swap to an append-only events table if volume ever demands it.
-- ============================================================================

create table if not exists experiments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  slot          text not null,                  -- headline|cta
  status        text not null default 'running',-- running|stopped|applied
  variants      jsonb not null default '[]',    -- [{id,label,text,impressions,conversions,control}]
  winner        text,                           -- winning variant id, once decided
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists experiments_business_idx on experiments (business_id, status, created_at desc);
create index if not exists experiments_org_idx on experiments (org_id, created_at desc);

drop trigger if exists experiments_set_updated_at on experiments;
create trigger experiments_set_updated_at before update on experiments
  for each row execute function set_updated_at();

alter table experiments enable row level security;

drop policy if exists experiments_owner on experiments;
create policy experiments_owner on experiments
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
