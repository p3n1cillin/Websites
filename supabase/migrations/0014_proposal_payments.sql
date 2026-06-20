-- ============================================================================
-- 0014_proposal_payments.sql — Real client payments on proposals.
--
-- A prospect can now PAY a proposal's build fee via Stripe Checkout (not just click
-- "accept"). These columns record the real cash collected so the Command Center can
-- distinguish COLLECTED (money in the bank) from merely SIGNED (agreed, unpaid).
--
-- Best-effort in the app layer: without these columns / without Stripe the proposal
-- still works with the free "accept" flow (degrades gracefully).
-- ============================================================================

alter table proposals add column if not exists paid_pence int;
alter table proposals add column if not exists paid_at timestamptz;
alter table proposals add column if not exists stripe_session_id text;
