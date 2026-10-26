import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Org } from "./types";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Admin auth + org resolution.
 *
 * `getCurrentOrg` bootstraps a `trial` org on first sign-in. All queries here go
 * through the authenticated, cookie-bound client so RLS guarantees a user only
 * ever sees / creates their own org.
 */

const TRIAL_DAYS = 14;

interface OrgRow {
  id: string;
  name: string;
  owner_user_id: string;
  plan: Org["plan"];
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
}

function toOrg(row: OrgRow): Org {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
  };
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * The current user's org, creating a 14-day trial org on first sign-in.
 * Returns null if the user is not authenticated.
 */
export async function getCurrentOrg(): Promise<Org | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing, error } = await supabase
    .from("orgs")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load org: ${error.message}`);
  if (existing) return toOrg(existing as OrgRow);

  // First sign-in: provision a trial org.
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);

  const { data: created, error: insertError } = await supabase
    .from("orgs")
    .insert({
      name: user.email?.split("@")[0] ?? "My workspace",
      owner_user_id: user.id,
      plan: "trial",
      trial_ends_at: trialEnds.toISOString(),
      subscription_status: "trialing",
    })
    .select("*")
    .single();

  if (insertError) throw new Error(`Failed to create org: ${insertError.message}`);
  return toOrg(created as OrgRow);
}

/**
 * Guard for admin pages/actions: returns the org or redirects to login.
 * Throws (caught upstream) if the user is signed in but has no resolvable org.
 */
export async function requireOrg(): Promise<Org> {
  const org = await getCurrentOrg();
  if (!org) redirect("/admin/login");
  return org;
}
