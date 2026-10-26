/**
 * Setup checklist — encodes the one-off "~5 hours" that takes the empire from
 * deployed-but-idle to fully autonomous. Pure + deterministic: every probe is
 * passed IN as data so it's unit-testable and the admin page owns the I/O.
 *
 * Each task carries the exact fix (env var / dashboard action / SQL file), so
 * the operator never has to guess what stands between them and autopilot.
 */

export interface SetupChecklistInput {
  /** NEXT_PUBLIC_SUPABASE_URL + anon key present. */
  supabaseConfigured: boolean;
  /** Service-role key present (writes/agents/automation need it). */
  supabaseWritable: boolean;
  /**
   * null = unknown (loop_state table unreadable → migrations not applied or
   * Supabase down); true = migration 0016 probed OK; false = readable but absent.
   */
  loopStateTableReadable: boolean | null;
  resendConfigured: boolean;
  stripeConfigured: boolean;
  cronSecretSet: boolean;
  inboundSecretSet: boolean;
  operatorEmailSet: boolean;
  prospectCount: number;
}

export interface SetupTask {
  id: string;
  title: string;
  done: boolean;
  /** Rough minutes for planning the ~5-hour block. */
  minutes: number;
  how: string;
  /** Grouping in the briefing UI. */
  group: "database" | "email" | "billing" | "automation";
}

export function getSetupChecklist(input: SetupChecklistInput): SetupTask[] {
  const tasks: SetupTask[] = [
    {
      id: "supabase",
      title: "Connect Supabase (URL + anon key)",
      done: input.supabaseConfigured,
      minutes: 15,
      how: "Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase → Project Settings → API.",
      group: "database",
    },
    {
      id: "service-role",
      title: "Add service-role key (writes + agents)",
      done: input.supabaseWritable,
      minutes: 5,
      how: "Set SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_). Required for every agent write and the automation tick.",
      group: "database",
    },
    {
      id: "migrations",
      title: "Apply migrations 0010–0016 in the SQL editor",
      done: input.loopStateTableReadable === true,
      minutes: 30,
      how: "Run supabase/migrations/0010…0016 in Supabase → SQL Editor. Until applied, preview analytics, AI cache, retainers/subscriptions, paid proposals and the loop-state table stay inert (the app degrades gracefully).",
      group: "database",
    },
    {
      id: "resend",
      title: "Verify sending domain + set outreach sender",
      done: input.resendConfigured,
      minutes: 45,
      how: "Add RESEND_API_KEY + OUTREACH_FROM_EMAIL (an address on a Resend-verified domain). Verify your domain at resend.com/domains — unverified domains get sends rejected.",
      group: "email",
    },
    {
      id: "inbound",
      title: "Point Resend Inbound at the reply webhook",
      done: input.inboundSecretSet,
      minutes: 20,
      how: "In Resend → Inbound, route replies to https://YOUR-DOMAIN/api/webhooks/resend?secret=RESEND_INBOUND_SECRET. This is what stops follow-ups chasing prospects who already replied.",
      group: "email",
    },
    {
      id: "operator-email",
      title: "Set the weekly digest recipient",
      done: input.operatorEmailSet,
      minutes: 2,
      how: "Set OPERATOR_NOTIFY_EMAIL to the inbox you read weekly. The digest arrives only when something needs you.",
      group: "email",
    },
    {
      id: "stripe",
      title: "Configure Stripe (keys + webhook)",
      done: input.stripeConfigured,
      minutes: 30,
      how: "Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (+ STRIPE_PRICE_* if selling plans). Enables real card-paid proposals and retainer subscriptions — true MRR.",
      group: "billing",
    },
    {
      id: "cron-secret",
      title: "Set CRON_SECRET for the automation tick",
      done: input.cronSecretSet,
      minutes: 5,
      how: "Generate a long random value for CRON_SECRET. Vercel Cron sends it as a Bearer token; manual runs use ?secret=.",
      group: "automation",
    },
    {
      id: "seed-pipeline",
      title: "Seed the first discovery campaign",
      done: input.prospectCount > 0,
      minutes: 60,
      how: "Run one discovery campaign from /admin/prospects (or trigger the autopilot once). The loop re-tops the pipeline itself afterwards; it just needs a foothold to expand from.",
      group: "automation",
    },
  ];
  return tasks;
}

/** True when everything the autonomous loops need is in place. */
export function checklistComplete(tasks: SetupTask[]): boolean {
  return tasks.every((t) => t.done);
}
