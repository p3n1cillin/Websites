-- ============================================================================
-- 0011_ai_cache.sql — AI response cache (Agency OS, Phase 6 / token economy).
--
-- Content-addressed cache so we never pay for the same AI generation twice:
-- expensive deterministic-input calls (e.g. the Industry Profiler for a given
-- prospect) store their JSON result under a stable key and reuse it on re-runs.
-- Org-scoped; written/read SERVER-SIDE via the service role. Entirely best-effort
-- in the app layer — a missing table just means "always a cache miss".
-- ============================================================================

create table if not exists ai_cache (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  cache_key   text not null,
  value       jsonb not null,
  model       text,
  hits        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One row per (org, key); upserts bump hits.
create unique index if not exists ai_cache_org_key_uniq on ai_cache (org_id, cache_key);

drop trigger if exists ai_cache_set_updated_at on ai_cache;
create trigger ai_cache_set_updated_at before update on ai_cache
  for each row execute function set_updated_at();

alter table ai_cache enable row level security;

drop policy if exists ai_cache_owner on ai_cache;
create policy ai_cache_owner on ai_cache
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
