-- ============================================================================
-- 0009_proposals.sql — Outreach sequences + proposals (Agency OS, Agent 8++).
--
--  * outreach_messages gains `intent` + `step` so the Sales agent can draft a
--    timed FOLLOW-UP SEQUENCE (initial → follow-up → final), not just one touch.
--  * proposals — a tokenised sales proposal (scope, price, timeline) the prospect
--    views at /proposal/[token] and can ACCEPT, which closes the deal (→ won).
--
-- Owner-all RLS via my_org_ids(); the public proposal is read SERVER-SIDE by its
-- opaque token (capability-by-token, same model as site_previews / portals).
-- ============================================================================

alter table outreach_messages
  add column if not exists intent text not null default 'initial', -- initial|follow_up|final
  add column if not exists step int not null default 0;            -- order within a sequence

create table if not exists proposals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  prospect_id   uuid not null references prospects(id) on delete cascade,
  token         text not null unique,
  title         text not null,
  summary       text not null,
  deliverables  jsonb not null default '[]',   -- string[]
  price_pence   int not null default 0,        -- one-off build fee, pence
  price_note    text,                          -- e.g. "+ £39/month hosting & support"
  timeline      text,
  status        text not null default 'draft', -- draft|sent|accepted|declined
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists proposals_org_idx on proposals (org_id, created_at desc);
create index if not exists proposals_prospect_idx on proposals (prospect_id, created_at desc);

drop trigger if exists proposals_set_updated_at on proposals;
create trigger proposals_set_updated_at before update on proposals
  for each row execute function set_updated_at();

alter table proposals enable row level security;

drop policy if exists proposals_owner on proposals;
create policy proposals_owner on proposals
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
