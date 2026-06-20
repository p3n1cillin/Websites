"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { parseBusinessForm } from "@/lib/business-form";
import { orgEntitlement, customDomainsAllowed } from "@/lib/plans";
import { validateCustomDomain } from "@/lib/domains";
import {
  createBusiness,
  updateBusiness,
  setBusinessStatus,
  setCustomDomain,
  deleteBusiness,
  getBusinessRecord,
  getBusinessesForOrg,
} from "@/lib/businesses";
import type { BusinessRecord } from "@/lib/types";

export interface FormActionState {
  error?: string;
  message?: string;
}

/**
 * Ownership guard. Writes use the service role (which bypasses RLS), so every
 * mutation MUST confirm the target business belongs to the caller's org.
 */
async function requireOwned(id: string, orgId: string): Promise<BusinessRecord> {
  const record = await getBusinessRecord(id);
  if (!record || record.orgId !== orgId) redirect("/admin/businesses");
  return record;
}

export async function createBusinessAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const org = await requireOrg();
  const { data, errors } = parseBusinessForm(formData);
  if (!data) return { error: errors.join(" ") };

  // Paywall: enforce the plan's business limit.
  const entitlement = orgEntitlement(org);
  const existingCount = (await getBusinessesForOrg(org.id)).length;
  if (existingCount >= entitlement.businessLimit) {
    return {
      error: `Your ${org.plan} plan allows ${entitlement.businessLimit} business${
        entitlement.businessLimit === 1 ? "" : "es"
      }. Upgrade on the Billing page to add more.`,
    };
  }

  let created: BusinessRecord;
  try {
    created = await createBusiness({ orgId: org.id, data, status: "draft" });
  } catch (err) {
    return { error: friendly(err) };
  }
  revalidatePath("/admin/businesses");
  redirect(`/admin/businesses/${created.id}?created=1`);
}

export async function updateBusinessAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const org = await requireOrg();
  const id = formData.get("id") as string;
  const existing = await requireOwned(id, org.id);

  const { data, errors } = parseBusinessForm(formData, existing.data);
  if (!data) return { error: errors.join(" ") };

  try {
    await updateBusiness(id, data);
  } catch (err) {
    return { error: friendly(err) };
  }
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${id}`);
  return { message: "Saved." };
}

export async function publishAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = formData.get("id") as string;
  const next = (formData.get("status") as string) === "published" ? "draft" : "published";
  await requireOwned(id, org.id);

  // Paywall: only entitled orgs (active trial/subscription) may publish.
  // Unpublishing is always allowed so a lapsed org can still take a site down.
  if (next === "published" && !orgEntitlement(org).active) {
    redirect("/admin/billing?error=stripe");
  }

  await setBusinessStatus(id, next);
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${id}`);
}

/**
 * Set or clear a business's custom domain. Gated to Pro+ plans. Clearing is
 * always allowed (so a downgraded org can remove a domain it can no longer use).
 */
export async function setCustomDomainAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = formData.get("id") as string;
  await requireOwned(id, org.id);

  const raw = ((formData.get("customDomain") as string | null) ?? "").trim();

  // Clearing the domain.
  if (!raw) {
    try {
      await setCustomDomain(id, null);
    } catch {
      redirect(`/admin/businesses/${id}?domain=error`);
    }
    revalidatePath(`/admin/businesses/${id}`);
    redirect(`/admin/businesses/${id}?domain=cleared`);
  }

  if (!customDomainsAllowed(org.plan)) {
    redirect(`/admin/businesses/${id}?domain=plan`);
  }

  const { domain, error } = validateCustomDomain(raw);
  if (error || !domain) {
    redirect(`/admin/businesses/${id}?domain=invalid`);
  }

  try {
    await setCustomDomain(id, domain);
  } catch (err) {
    const taken = /duplicate key|unique/i.test(err instanceof Error ? err.message : "");
    redirect(`/admin/businesses/${id}?domain=${taken ? "taken" : "error"}`);
  }
  revalidatePath(`/admin/businesses/${id}`);
  redirect(`/admin/businesses/${id}?domain=saved`);
}

export async function deleteBusinessAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = formData.get("id") as string;
  await requireOwned(id, org.id);
  await deleteBusiness(id);
  revalidatePath("/admin/businesses");
  redirect("/admin/businesses");
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/duplicate key|unique/i.test(msg)) {
    return "That slug is already taken in this city — choose a different slug.";
  }
  return msg;
}
