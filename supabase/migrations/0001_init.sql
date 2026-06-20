-- ============================================================================
-- 0001_init.sql — Multi-tenant SaaS foundation.
--
-- Supersedes the single `businesses(data jsonb)` table described in the README.
-- Tenancy boundary is `orgs` (the paying customer); a business (= one website)
-- belongs to an org. Tenant isolation is enforced by Row Level Security: an
-- authenticated admin can only ever see rows belonging to their own org, while
-- the public sites read only `published` businesses.
--
-- The proven `Business` shape (lib/types.ts) is preserved inside
-- `businesses.data` (jsonb) so the existing render path is unchanged; only the
-- columns we filter / sort / join on are promoted out of the blob.
-- ============================================================================

-- Needed for gen_random_uuid() on older Postgres images.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ORGS — the billing tenant. One owner; many businesses on higher plans.
-- ----------------------------------------------------------------------------
create table if not exists orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan          text not null default 'trial',        -- trial|basic|pro|premium
  trial_ends_at timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text default 'trialing',     -- mirrors Stripe
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orgs_owner_idx on orgs (owner_user_id);

-- ----------------------------------------------------------------------------
-- BUSINESSES — one generated website. `data` keeps the full Business object.
-- ----------------------------------------------------------------------------
create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  slug          text not null,
  city          text not null default 'Warrington',   -- was hardcoded in copy
  category      text not null,
  status        text not null default 'draft',         -- draft|published
  custom_domain text unique,
  data          jsonb not null,                        -- the Business object
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (city, slug)                                  -- enables /[city]/[slug]
);
create index if not exists businesses_org_idx on businesses (org_id);
create index if not exists businesses_published_idx
  on businesses (status) where status = 'published';

-- ----------------------------------------------------------------------------
-- CONTENT_BLOCKS — CMS-driven page sections (replaces hardcoded page bodies).
-- ----------------------------------------------------------------------------
create table if not exists content_blocks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  page        text not null,            -- home|services|about|contact|book
  section_key text not null,            -- hero|trust|about|cta...
  content     jsonb not null,
  position    int not null default 0,
  unique (business_id, page, section_key)
);
create index if not exists content_blocks_biz_idx on content_blocks (business_id);

-- ----------------------------------------------------------------------------
-- BLOG_POSTS — SEO automation output.
-- ----------------------------------------------------------------------------
create table if not exists blog_posts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  slug        text not null,
  title       text not null,
  meta_description text,
  body_mdx    text not null,
  target_keyword   text,                -- "emergency plumber Latchford"
  service_ref text,                     -- internal-link target
  status      text not null default 'published',
  published_at timestamptz default now(),
  unique (business_id, slug)
);
create index if not exists blog_posts_biz_idx on blog_posts (business_id);

-- ----------------------------------------------------------------------------
-- LEADS — persisted form submissions (replaces log/webhook-only capture).
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type        text not null default 'enquiry',    -- enquiry|booking
  name        text not null,
  email       text,
  phone       text not null,
  service     text,
  message     text,
  preferred_date date,
  status      text not null default 'new',         -- new|contacted|won|lost
  source_path text,
  created_at  timestamptz not null default now()
);
create index if not exists leads_biz_created_idx on leads (business_id, created_at desc);

-- ----------------------------------------------------------------------------
-- INVOICES — Stripe invoice mirror for the billing dashboard.
-- ----------------------------------------------------------------------------
create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  stripe_invoice_id text unique,
  amount_due  int,                       -- pence
  currency    text not null default 'gbp',
  status      text,                       -- paid|open|void
  hosted_url  text,
  pdf_url     text,
  created_at  timestamptz not null default now()
);
create index if not exists invoices_org_idx on invoices (org_id);

-- ----------------------------------------------------------------------------
-- updated_at touch trigger.
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orgs_set_updated_at on orgs;
create trigger orgs_set_updated_at before update on orgs
  for each row execute function set_updated_at();

drop trigger if exists businesses_set_updated_at on businesses;
create trigger businesses_set_updated_at before update on businesses
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — the core of tenant isolation.
--
-- Authenticated admin traffic (anon key + a user JWT) is scoped to the user's
-- own org via auth.uid(). The public sites and server-side writes use the
-- service role key, which bypasses RLS; published-only filtering for public
-- reads is also expressed as a policy so the anon key alone is safe to expose.
-- ============================================================================
alter table orgs           enable row level security;
alter table businesses     enable row level security;
alter table content_blocks enable row level security;
alter table blog_posts     enable row level security;
alter table leads          enable row level security;
alter table invoices       enable row level security;

-- Helper: orgs owned by the current user.
create or replace function my_org_ids() returns setof uuid
  language sql stable security definer as $$
  select id from orgs where owner_user_id = auth.uid();
$$;

-- ORGS: owner-only.
drop policy if exists orgs_owner on orgs;
create policy orgs_owner on orgs
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- BUSINESSES: owner can manage their org's rows; anyone can read published.
drop policy if exists businesses_owner on businesses;
create policy businesses_owner on businesses
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));

drop policy if exists businesses_public_read on businesses;
create policy businesses_public_read on businesses
  for select using (status = 'published');

-- CONTENT_BLOCKS / BLOG_POSTS: scoped through the parent business.
drop policy if exists content_owner on content_blocks;
create policy content_owner on content_blocks
  for all using (business_id in (
    select id from businesses where org_id in (select my_org_ids())))
  with check (business_id in (
    select id from businesses where org_id in (select my_org_ids())));

drop policy if exists content_public_read on content_blocks;
create policy content_public_read on content_blocks
  for select using (business_id in (
    select id from businesses where status = 'published'));

drop policy if exists blog_owner on blog_posts;
create policy blog_owner on blog_posts
  for all using (business_id in (
    select id from businesses where org_id in (select my_org_ids())))
  with check (business_id in (
    select id from businesses where org_id in (select my_org_ids())));

drop policy if exists blog_public_read on blog_posts;
create policy blog_public_read on blog_posts
  for select using (status = 'published' and business_id in (
    select id from businesses where status = 'published'));

-- LEADS: owner-only (no public read; inserts come from the server/service role).
drop policy if exists leads_owner on leads;
create policy leads_owner on leads
  for all using (business_id in (
    select id from businesses where org_id in (select my_org_ids())))
  with check (business_id in (
    select id from businesses where org_id in (select my_org_ids())));

-- INVOICES: owner read-only (rows are written by the Stripe webhook / service role).
drop policy if exists invoices_owner on invoices;
create policy invoices_owner on invoices
  for select using (org_id in (select my_org_ids()));
