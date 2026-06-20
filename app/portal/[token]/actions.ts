"use server";

import { revalidatePath } from "next/cache";
import { getActivePortalByToken } from "@/lib/customers";
import { createChangeRequest } from "@/lib/change-requests";

/**
 * Public portal submit (no auth — the opaque token is the capability). We resolve
 * the org + business from the active portal token server-side, so a customer can
 * only ever file a request against their own site. Service-role write.
 */
export async function submitChangeRequestAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const token = (formData.get("token") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const detail = ((formData.get("detail") as string) ?? "").trim();
  if (!token) return { ok: false, error: "Invalid portal." };
  if (!title) return { ok: false, error: "Please describe the change you'd like." };

  const portal = await getActivePortalByToken(token);
  if (!portal) return { ok: false, error: "This portal link is no longer active." };

  await createChangeRequest({
    orgId: portal.orgId,
    businessId: portal.businessId,
    title,
    detail: detail || null,
    source: "customer",
  });
  revalidatePath(`/portal/${token}`);
  return { ok: true };
}
