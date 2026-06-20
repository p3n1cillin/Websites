"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { getBusinessRecord } from "@/lib/businesses";
import { getLeadRecord, updateLeadStatus } from "@/lib/leads";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const id = formData.get("id") as string;
  const status = formData.get("status") as LeadStatus;
  if (!LEAD_STATUSES.includes(status)) redirect("/admin/leads");

  // Ownership: the lead's business must belong to the caller's org.
  const lead = await getLeadRecord(id);
  if (!lead) redirect("/admin/leads");
  const biz = await getBusinessRecord(lead.businessId);
  if (!biz || biz.orgId !== org.id) redirect("/admin/leads");

  await updateLeadStatus(id, status);
}
