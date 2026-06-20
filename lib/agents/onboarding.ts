/**
 * Onboarding agent (Agent 9) — the won → customer transition.
 *
 * When a deal is won, it turns the prospect's approved demo into a real, owned
 * site: it provisions a `businesses` row (status draft) from the latest preview's
 * Business draft + Design DNA, opens a tokenised customer portal, and advances the
 * prospect to `won`. The operator then publishes from the existing Businesses /
 * Factory tools. Side-effecting: persists only on `auto`.
 *
 * It requires a preview to exist (the demo IS the spec we sold) — if none, it
 * fails cleanly asking for one. No AI is involved; this is a deterministic
 * provisioning step.
 */

import { createBusiness, getBusinessRecord } from "../businesses";
import { ensureCustomerPortal, getPortalForProspect } from "../customers";
import { getPreviewsForOrg } from "../previews";
import { updateProspectStatus } from "../prospects";
import { SITE_URL } from "../seo";
import type { Business, Prospect } from "../types";
import type { AgentDefinition } from "./types";

export interface OnboardingAgentInput {
  prospect: Prospect;
}

export interface OnboardingAgentOutput {
  applied: boolean;
  businessId?: string;
  slug?: string;
  portalUrl?: string;
}

export const onboardingAgent: AgentDefinition<OnboardingAgentInput, OnboardingAgentOutput> = {
  kind: "onboarding",
  title: "Onboarding",
  description:
    "Turns a won prospect's demo into a real owned site and opens their customer portal.",
  defaultAutonomy: "approve",
  sideEffecting: true,
  async handler(input, ctx) {
    const p = input.prospect;

    // Idempotent: if this prospect was already onboarded, reuse its portal/site.
    const existingPortal = await getPortalForProspect(p.id);
    if (existingPortal) {
      const record = await getBusinessRecord(existingPortal.businessId);
      const portalUrl = `${SITE_URL}/portal/${existingPortal.token}`;
      return {
        output: { applied: true, businessId: existingPortal.businessId, slug: record?.slug, portalUrl },
        summary: `${p.name} is already onboarded — portal ready.`,
      };
    }

    // The demo we sold is the spec — onboard from the latest active preview.
    const previews = await getPreviewsForOrg(ctx.orgId);
    const preview = previews.find((pv) => pv.prospectId === p.id && pv.status === "active");
    if (!preview) {
      throw new Error("No active demo to onboard from — generate a preview for this prospect first.");
    }

    // Embed the chosen DNA so the live site renders exactly like the demo.
    const data: Business = { ...preview.businessDraft, design: preview.designDna };

    const applied = ctx.autonomy === "auto";
    let businessId: string | undefined;
    let slug: string | undefined;
    let portalUrl: string | undefined;

    if (applied) {
      const record = await createBusiness({ orgId: ctx.orgId, data, status: "draft" });
      businessId = record.id;
      slug = record.slug;
      const portal = await ensureCustomerPortal({
        orgId: ctx.orgId,
        businessId: record.id,
        prospectId: p.id,
      });
      portalUrl = `${SITE_URL}/portal/${portal.token}`;
      // Mark the deal won (never regress a closed deal).
      if (p.status !== "won") await updateProspectStatus(p.id, "won");
    }

    return {
      output: { applied, businessId, slug, portalUrl },
      summary: applied
        ? `Onboarded ${p.name} → draft site created + customer portal opened.`
        : `Ready to onboard ${p.name} from its demo.`,
      action: { prospectId: p.id, draft: data, previewId: preview.id },
    };
  },
};
