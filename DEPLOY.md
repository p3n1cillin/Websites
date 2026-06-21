# Deploy & go live

This app is a standard Next.js 14 project — deploy it on **Vercel** (best fit; the
cron jobs in `vercel.json` only run there). I can't deploy it for you (it needs your
Vercel + GitHub login and is billed to your account), but this is the whole path.

## 1. Push the code

```bash
git push            # from your terminal — approve the GitHub credential prompt
```

## 2. Import to Vercel

1. https://vercel.com → **Add New → Project** → import the GitHub repo `p3nicillin/Websites`.
2. Framework: **Next.js** (auto-detected). Build command + output: defaults.
3. Don't deploy yet — set the environment variables first (next step).

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Copy these from your local `.env.local`:

**Core**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `NEXT_PUBLIC_SITE_URL` = your live URL, e.g. `https://yourdomain.com` (no trailing slash)
- `CRON_SECRET` = any long random string (Vercel cron uses it to call `/api/automation/tick`)

**AI** (optional but recommended)
- `ANTHROPIC_API_KEY`, `AI_*_CAP_PENCE` spend caps

**Payments (Stripe)** — to take real money
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (from step 5)

**Outreach (Resend)** — so autopilot can actually send emails
- `RESEND_API_KEY`, `OUTREACH_FROM_EMAIL` (address on your verified domain)


**Public brand** (shown on your homepage — Stripe reviews this)
- `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_LEGAL_NAME`
- `NEXT_PUBLIC_BRAND_EMAIL` (required — your real contact email)
- `NEXT_PUBLIC_BRAND_PHONE` (optional), `NEXT_PUBLIC_BRAND_LOCATION`

## 4. Deploy + apply migrations

1. Click **Deploy**. You get a live URL (`yourapp.vercel.app` or your custom domain).
2. In the Supabase SQL editor, apply any migrations not yet run: `0010`–`0014`.

## 5. Stripe webhook (production)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://yourdomain.com/api/stripe/webhook`.
3. Events: at least `checkout.session.completed`, `customer.subscription.*`, `invoice.*`.
4. Copy the **Signing secret** → set `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.

(Client proposal payments also self-confirm on the success redirect, so the webhook is
belt-and-suspenders for proposals — but it's required for subscription/billing events.)

## 6. Register the business on Stripe

Use your live URL as the business website. Stripe reviews:
- Homepage (what you sell): `/`
- Pricing: `/pricing`
- Contact: `/contact`
- Refund/cancellation + terms: `/terms`
- Privacy: `/privacy`

## 7. Autopilot runs itself

`vercel.json` already schedules `/api/automation/tick` (every 2h). Each run drives the
funnel: discover → build demos → send due outreach → pursue/advance ventures. It never
fabricates sends or payments — anything needing you (approvals, payment, credentials)
is reported, not faked. Trigger a pass manually anytime from the Command Center → **Run
autopilot now**.

## Reality check

The system automates discovery, builds, outreach drafting/sending and pipeline
movement. It cannot create revenue without the real-world pieces only you can supply:
a deployed public site, Stripe live keys, a Resend key (to actually send), and your
go-ahead on ventures. Once those are set, money flows through the funnel hands-off.
