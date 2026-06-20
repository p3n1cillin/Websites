-- ============================================================================
-- 0004_sales.sql — Sales: previews + outreach (Phase E of the Agency OS).
--
-- Turns an analysed `prospect` into a sale:
--   * site_previews     — a generated demo site for a prospect (the sales asset),
--                         viewable via an opaque, expiring token before any deal.
--   * outreach_messages — generated sales comms + thread state (email/SMS drafts).
--
-- The Prospecting agent (7) builds the preview; the Sales agent (8) drafts the
-- outreach. Both are operator-facing tables, so they get a full owner RLS policy
-- (read + write via the anon key + user JWT); the agents write with the service
-- role, which bypasses RLS. Scoping reuses my_org_ids() (0001).
--
-- SECURITY NOTE — the public preview at /preview/[token] is read SERVER-SIDE with
-- the service role, filtered by the exact opaque token (the capability). We do NOT
-- add an anon "select" policy on site_previews: an RLS row-predicate cannot encode
-- "only when filtered by token", so `using(true)` would expose every draft to any
-- anon-key holder. Capability-by-token over the server role is strictly safer and
-- gives the same unauthenticated UX. See docs/AGENCY_OS.md §5.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- site_previews — one generated demo per (prospect, token).
-- ---------------------------------------------------------------------------
create table if not exists site_previews (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  prospect_id     uuid not null references prospects(id) on delete cascade,
  business_draft  jsonb not null,                 -- the scaffolded Business object
  design_dna      jsonb not null,                 -- the chosen DesignDNA
  qa_score        int not null default 0,         -- 0–100 (QA agent overall)
  qa_report       jsonb,                          -- full QaReport
  preview_token   text not null unique,           -- opaque, unguessable capability
  status          text not null default 'active', -- active|revoked
  views           int not null default 0,         -- how many times the demo was opened
  last_viewed_at  timestamptz,
  expires_at      timestamptz,                    -- null = never; agent sets ~30 days out
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists site_previews_org_idx on site_previews (org_id, created_at desc);
create index if not exists site_previews_prospect_idx on site_previews (prospect_id, created_at desc);

drop trigger if exists site_previews_set_updated_at on site_previews;
create trigger site_previews_set_updated_at before update on site_previews
  for each row execute function set_updated_at();

alter table site_previews enable row level security;

drop policy if exists site_previews_owner on site_previews;
create policy site_previews_owner on site_previews
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

-- ---------------------------------------------------------------------------
-- outreach_messages — generated sales comms + thread state.
-- ---------------------------------------------------------------------------
create table if not exists outreach_messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  prospect_id   uuid not null references prospects(id) on delete cascade,
  channel       text not null default 'email',    -- email|sms
  direction     text not null default 'outbound', -- outbound|inbound
  subject       text,
  body          text not null,
  status        text not null default 'draft',    -- draft|sent|failed|received
  ai            boolean not null default false,    -- copy written by the model vs heuristic
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists outreach_org_prospect_idx
  on outreach_messages (org_id, prospect_id, created_at desc);

alter table outreach_messages enable row level security;

drop policy if exists outreach_owner on outreach_messages;
create policy outreach_owner on outreach_messages
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
