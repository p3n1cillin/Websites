"use server";

import { requireOrg } from "@/lib/auth";
import { runAgent } from "@/lib/agents/runner";
import type { SuccessAgentInput } from "@/lib/agents/success";
import { getBusinessRecord } from "@/lib/businesses";
import { getPortalRecord, setPortalStatus } from "@/lib/customers";
import {
  getChangeRequestRecord,
  updateChangeRequestStatus,
  deleteChangeRequest,
} from "@/lib/change-requests";
import {
  getRetainerRecord,
  setRetainerStatus,
  setRetainerAmount,
} from "@/lib/retainers";
import {
  CHANGE_REQUEST_STATUSES,
  RETAINER_STATUSES,
  type ChangeRequestStatus,
  type CustomerReport,
  type RetainerStatus,
} from "@/lib/types";

/** Run the Success agent for one of the org's businesses (read-only report). */
export async function runReportAction(
  businessId: string
): Promise<{ ok: boolean; report?: CustomerReport; error?: string }> {
  const org = await requireOrg();
  const record = await getBusinessRecord(businessId);
  if (!record || record.orgId !== org.id) return { ok: false, error: "Business not found." };

  const input: SuccessAgentInput = { businessId };
  const res = await runAgent<CustomerReport>({
    kind: "success",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "suggest", // read-only — run + return, no side effects
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Report failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true, report: res.output };
}

export async function setChangeRequestStatusAction(
  id: string,
  status: ChangeRequestStatus
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!CHANGE_REQUEST_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const cr = await getChangeRequestRecord(id);
  if (!cr || cr.orgId !== org.id) return { ok: false, error: "Request not found." };
  await updateChangeRequestStatus(id, status);
  return { ok: true };
}

export async function deleteChangeRequestAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const cr = await getChangeRequestRecord(id);
  if (!cr || cr.orgId !== org.id) return { ok: false, error: "Request not found." };
  await deleteChangeRequest(id);
  return { ok: true };
}

/** Pause / resume / cancel a client's recurring retainer (changes true MRR). */
export async function setRetainerStatusAction(
  id: string,
  status: RetainerStatus
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!RETAINER_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const r = await getRetainerRecord(id);
  if (!r || r.orgId !== org.id) return { ok: false, error: "Retainer not found." };
  await setRetainerStatus(id, status);
  return { ok: true };
}

/** Set a client's agreed monthly fee (pounds → pence). */
export async function setRetainerAmountAction(
  id: string,
  monthlyPounds: number
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!Number.isFinite(monthlyPounds) || monthlyPounds < 0) {
    return { ok: false, error: "Invalid amount." };
  }
  const r = await getRetainerRecord(id);
  if (!r || r.orgId !== org.id) return { ok: false, error: "Retainer not found." };
  await setRetainerAmount(id, Math.round(monthlyPounds * 100));
  return { ok: true };
}

export async function revokePortalAction(
  portalId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const portal = await getPortalRecord(portalId);
  if (!portal || portal.orgId !== org.id) return { ok: false, error: "Portal not found." };
  await setPortalStatus(portalId, "revoked");
  return { ok: true };
}
