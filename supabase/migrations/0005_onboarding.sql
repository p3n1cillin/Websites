-- ============================================================================
-- 0005_onboarding.sql — Onboarding + Customer Portal (Phase F of the Agency OS).
--
-- The won → customer transition. When a deal is won the Onboarding agent (9)
-- provisions a real `businesses` row from the prospect's demo and opens a
-- customer portal; the Success agent (10) reports on it. Two tables:
--
--   * customer_portals  — capability-by-token access for the END customer to view
--                         their site + submit changes (one per business).
--   * change_requests   — the customer's (or operator's) edit requests + triage.
--
-- Owner-all RLS via my_org_ids() (operators manage from /admin/customers). The
-- public portal at /portal/[token] is read SERVER-SIDE with the service role,
-- filtered by the exact opaque token — same capability-by-token model as
-- site_previews (see 0004). We do NOT add an anon select policy. See §5 + §10.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- customer_portals — one tokenised portal per onboarded business.
-- ---------------------------------------------------------------------------
create table if not exists customer_portals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  prospect_id   uuid references prospects(id) on delete set null, -- provenance
  portal_token  text not null unique,           -- opaque capability for the customer
  status        text not null default 'active', -- active|revoked
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One portal per business (re-onboarding is idempotent).
create unique index if not exists customer_portals_business_uniq on customer_portals (business_id);
create index if not exists customer_portals_org_idx on customer_portals (org_id, created_at desc);

drop trigger if exists customer_portals_set_updated_at on customer_portals;
create trigger customer_portals_set_updated_at before update on customer_portals
  for each row execute function set_updated_at();

alter table customer_portals enable row level security;

drop policy if exists customer_portals_owner on customer_portals;
create policy customer_portals_owner on customer_portals
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

-- ---------------------------------------------------------------------------
-- change_requests — customer/operator edit requests + triage state.
-- ---------------------------------------------------------------------------
create table if not exists change_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  title         text not null,
  detail        text,
  status        text not null default 'open',     -- open|in_progress|done|declined
  source        text not null default 'customer', -- customer|admin
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists change_requests_org_idx
  on change_requests (org_id, business_id, created_at desc);

drop trigger if exists change_requests_set_updated_at on change_requests;
create trigger change_requests_set_updated_at before update on change_requests
  for each row execute function set_updated_at();

alter table change_requests enable row level security;

drop policy if exists change_requests_owner on change_requests;
create policy change_requests_owner on change_requests
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
