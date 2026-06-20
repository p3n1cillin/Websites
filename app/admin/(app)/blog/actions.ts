"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { orgEntitlement } from "@/lib/plans";
import { getBusinessesForOrg } from "@/lib/businesses";
import { runSeoGeneration } from "@/lib/blog";
import { supabaseWritable } from "@/lib/supabase/client";

/**
 * Manually run the SEO engine for the current org's published businesses.
 * Mirrors the nightly cron but scoped to the caller's tenant. Gated by the same
 * entitlement as publishing — a lapsed trial/subscription can't generate content.
 */
export async function generateArticlesAction(): Promise<void> {
  const org = await requireOrg();

  if (!supabaseWritable) {
    redirect("/admin/blog?error=config");
  }
  if (!orgEntitlement(org).active) {
    redirect("/admin/blog?error=inactive");
  }

  const published = (await getBusinessesForOrg(org.id)).filter((b) => b.status === "published");
  if (published.length === 0) {
    redirect("/admin/blog?error=nobusinesses");
  }

  let created = 0;
  try {
    ({ created } = await runSeoGeneration(published));
  } catch (err) {
    console.error("[blog] generation failed:", err);
    redirect("/admin/blog?error=failed");
  }

  revalidatePath("/admin/blog");
  redirect(`/admin/blog?created=${created}`);
}
