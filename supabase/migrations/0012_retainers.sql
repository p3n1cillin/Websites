-- ============================================================================
-- 0012_retainers.sql — Client retainers (Agency OS, revenue-truth layer).
--
-- A `client_retainer` is the real, agreed monthly recurring fee for a WON client.
-- One per won prospect/business. The Command Center reads the SUM of ACTIVE
-- retainers as true MRR — replacing the old "won count × £39" projection — so the
-- £1,000/mo goal reflects what's actually agreed and live, and drops on churn
-- (pause / cancel). Org-scoped; written/read SERVER-SIDE via the service role.
--
-- Entirely best-effort in the app layer: a missing table just means "no retainers
-- yet" and the dashboard falls back to the projection — nothing breaks.
-- ============================================================================

create table if not exists client_retainers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  prospect_id   uuid references prospects(id) on delete set null,
  business_id   uuid references businesses(id) on delete set null,
  name          text not null,
  monthly_pence int not null default 3900,
  status        text not null default 'active'
                check (status in ('active', 'paused', 'cancelled')),
  note          text,
  started_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- At most one retainer per won prospect (the win hook is idempotent on this).
create unique index if not exists client_retainers_prospect_uniq
  on client_retainers (prospect_id) where prospect_id is not null;
create index if not exists client_retainers_org_idx on client_retainers (org_id);

drop trigger if exists client_retainers_set_updated_at on client_retainers;
create trigger client_retainers_set_updated_at before update on client_retainers
  for each row execute function set_updated_at();

alter table client_retainers enable row level security;

drop policy if exists client_retainers_owner on client_retainers;
create policy client_retainers_owner on client_retainers
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
