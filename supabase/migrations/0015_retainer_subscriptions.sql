-- ============================================================================
-- 0015_retainer_subscriptions.sql — link client retainers to real Stripe subs.
--
-- When a client pays a proposal, Checkout now starts a recurring SUBSCRIPTION for
-- the monthly care plan (plus the one-off build fee). These columns tie the local
-- retainer row to that Stripe subscription so webhook events (cancelled / past-due)
-- keep the retainer's status — and therefore MRR — honest.
--
-- Best-effort in the app layer: retainer creation still works without these columns
-- (the subscription link is applied separately, try/caught) — degrades gracefully.
-- ============================================================================

alter table client_retainers add column if not exists stripe_subscription_id text;
alter table client_retainers add column if not exists stripe_customer_id text;

create index if not exists client_retainers_sub_idx
  on client_retainers (stripe_subscription_id) where stripe_subscription_id is not null;
