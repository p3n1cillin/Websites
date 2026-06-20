-- ============================================================================
-- 0008_industry_intelligence.sql — Universal Industry Intelligence (Agency OS).
--
-- The acquisition pipeline already preserves the RAW industry text on every
-- prospect (prospects.source -> industry) precisely so it can be understood
-- WITHOUT collapsing it into a hardcoded BusinessCategory bucket. This migration
-- adds the persistence the Industry Intelligence agent needs to turn that raw
-- text into a dynamic, per-business strategy — and the cross-run learning memory
-- that lets the system get better at each industry over time.
--
-- Three tables, all org-scoped with the same owner RLS as prospects (0003):
--   industry_profiles : one AI-derived strategy per prospect (the "what they sell,
--                       who buys, what the site needs" understanding for ANY trade).
--   ai_knowledge      : the learning loop — aggregated understanding / winning
--                       patterns keyed by a normalised industry signature, so a
--                       second collectables shop benefits from the first.
--   website_dna       : the persisted brand + layout + content + feature decisions
--                       for a build (a durable record of the generated genome).
--
-- Agents write with the service role (bypasses RLS); operators read from the
-- dashboard through the owner policy. Scoping reuses my_org_ids() + set_updated_at
-- (both from 0001).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- industry_profiles — the dynamic Industry Profile for a single prospect.
-- ---------------------------------------------------------------------------
create table if not exists industry_profiles (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  prospect_id    uuid not null references prospects(id) on delete cascade,
  industry_label text not null default '',         -- the raw industry understood (e.g. "trading cards")
  profile        jsonb not null,                   -- IndustryProfile (identity + website strategy + design rec)
  ai             boolean not null default false,   -- true = AI-written, false = deterministic stub
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One current profile per prospect (the agent upserts on re-run).
create unique index if not exists industry_profiles_prospect_uniq
  on industry_profiles (prospect_id);
create index if not exists industry_profiles_org_idx
  on industry_profiles (org_id, created_at desc);

drop trigger if exists industry_profiles_set_updated_at on industry_profiles;
create trigger industry_profiles_set_updated_at before update on industry_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_knowledge — cross-run learning, keyed by (scope, signature).
--   scope     : 'industry' | 'design' | 'conversion' | 'seo'
--   signature : a normalised industry key (lowercased label) the agent groups by
--   data      : the accumulated understanding / winning pattern for that key
-- ---------------------------------------------------------------------------
create table if not exists ai_knowledge (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  scope       text not null,
  signature   text not null,
  data        jsonb not null default '{}'::jsonb,
  occurrences int  not null default 1,             -- how many businesses fed this row
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per (org, scope, signature) so the agent can read-then-merge.
create unique index if not exists ai_knowledge_key_uniq
  on ai_knowledge (org_id, scope, lower(signature));

drop trigger if exists ai_knowledge_set_updated_at on ai_knowledge;
create trigger ai_knowledge_set_updated_at before update on ai_knowledge
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- website_dna — the durable brand/layout/content/feature genome for a build.
-- prospect_id is the usual anchor (a demo built for a prospect); business_id is
-- left as a plain uuid (no FK) to stay decoupled from the live businesses store.
-- ---------------------------------------------------------------------------
create table if not exists website_dna (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete cascade,
  business_id uuid,
  dna         jsonb not null,                       -- { brand, layout, content, features }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists website_dna_prospect_uniq
  on website_dna (prospect_id);
create index if not exists website_dna_org_idx
  on website_dna (org_id, created_at desc);

drop trigger if exists website_dna_set_updated_at on website_dna;
create trigger website_dna_set_updated_at before update on website_dna
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — owner read + write, scoped via my_org_ids() (from 0001).
-- ============================================================================
alter table industry_profiles enable row level security;
alter table ai_knowledge      enable row level security;
alter table website_dna       enable row level security;

drop policy if exists industry_profiles_owner on industry_profiles;
create policy industry_profiles_owner on industry_profiles
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

drop policy if exists ai_knowledge_owner on ai_knowledge;
create policy ai_knowledge_owner on ai_knowledge
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

drop policy if exists website_dna_owner on website_dna;
create policy website_dna_owner on website_dna
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
