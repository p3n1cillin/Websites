-- ============================================================================
-- 0003_prospects.sql — Prospect CRM (Phase D of the Agency OS).
--
-- Adds the acquisition side of the pipeline: `prospects` are OUTBOUND discovery
-- targets (businesses we want to win), distinct from `leads` (a live customer's
-- INBOUND enquiries). The Discovery agent (1) populates this table; the Market
-- agent (2) scores + analyses each row. See docs/AGENCY_OS.md §5.
--
-- Like agent_settings/approvals, this is a table operators work with directly
-- from the dashboard (add prospects, advance the pipeline), so it gets a full
-- owner RLS policy (read + write via the anon key + user JWT). The agents write
-- with the service role, which bypasses RLS. Scoping reuses my_org_ids() (0001).
-- ============================================================================

create table if not exists prospects (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  name             text not null,
  category         text not null,                  -- BusinessCategory
  city             text not null default '',
  phone            text,
  email            text,
  website_url      text,
  presence_score   int not null default 0,         -- 0–100, strength of current web presence (low = opportunity)
  opportunity_score int not null default 0,        -- 0–100, priority to pursue
  value_estimate   int not null default 0,         -- estimated first-year value, pence
  status           text not null default 'discovered',
                   -- discovered|analysed|previewed|contacted|responded|negotiating|won|lost
  source           jsonb,                          -- provenance (manual|import|discovery + note)
  analysis         jsonb,                          -- Market agent verdict (summary, angle, personality, signals)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists prospects_org_status_idx
  on prospects (org_id, status, opportunity_score desc);
create index if not exists prospects_org_created_idx
  on prospects (org_id, created_at desc);

-- Dedup guard for re-runnable discovery: one row per (org, name, city).
create unique index if not exists prospects_org_name_city_uniq
  on prospects (org_id, lower(name), lower(city));

drop trigger if exists prospects_set_updated_at on prospects;
create trigger prospects_set_updated_at before update on prospects
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — owner read + write, scoped via my_org_ids() (from 0001).
-- ============================================================================
alter table prospects enable row level security;

drop policy if exists prospects_owner on prospects;
create policy prospects_owner on prospects
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
