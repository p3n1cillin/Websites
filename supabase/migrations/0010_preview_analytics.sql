-- ============================================================================
-- 0010_preview_analytics.sql — Shareable-demo analytics + optional password
-- (Agency OS, Phase 3).
--
--  * preview_events — per-interaction events on a tokenised /preview/[token] demo
--    (view, dwell, click, conversion) so a salesperson can SEE engagement:
--    "viewed 3×, spent 2m, tapped Call". Written SERVER-SIDE by /api/preview/track
--    via the service role (the public token is the capability), so no anon policy
--    is needed; the org owner reads them for the dashboard.
--  * site_previews.password — optional gate so a demo link can be shared privately.
-- ============================================================================

alter table site_previews
  add column if not exists password text; -- null = open link; set = password-gated

create table if not exists preview_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  preview_id  uuid not null references site_previews(id) on delete cascade,
  type        text not null,          -- view | dwell | click | conversion
  label       text,                   -- e.g. "call", "book", "contact"
  path        text,                   -- page path the event fired on
  value_ms    int,                    -- dwell milliseconds (for type='dwell')
  created_at  timestamptz not null default now()
);

create index if not exists preview_events_preview_idx on preview_events (preview_id, created_at desc);
create index if not exists preview_events_org_idx on preview_events (org_id, created_at desc);

alter table preview_events enable row level security;

drop policy if exists preview_events_owner on preview_events;
create policy preview_events_owner on preview_events
  for all using (org_id in (select my_org_ids()))
  with check (org_id in (select my_org_ids()));
