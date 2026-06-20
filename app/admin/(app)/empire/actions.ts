"use server";

import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getRetainersForOrg } from "@/lib/retainers";
import { getBusinessesForOrg } from "@/lib/businesses";
import { buildBusinessGraph } from "@/lib/discovery-graph";
import { buildEmpirePortfolio } from "@/lib/empire";
import {
  pursueOpportunity,
  advanceOpportunity,
  getOpportunityRecord,
} from "@/lib/opportunities";

/** Rebuild the catalog so we can resolve an opportunity by its (deterministic) id. */
async function catalogFor(orgId: string, orgName: string) {
  const [prospects, retainers, businesses] = await Promise.all([
    getProspectsForOrg(orgId),
    getRetainersForOrg(orgId),
    getBusinessesForOrg(orgId),
  ]);
  const graph = buildBusinessGraph(prospects);
  return buildEmpirePortfolio({
    clusters: graph.clusters,
    retainers,
    liveSites: businesses.filter((b) => b.status === "published").length,
    prospectCount: prospects.length,
    orgName,
  });
}

/** Pursue a catalog opportunity → start tracking it through the lifecycle. */
export async function pursueOpportunityAction(ref: string): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const portfolio = await catalogFor(org.id, org.name);
  const opp = portfolio.opportunities.find((o) => o.id === ref);
  if (!opp) return { ok: false, error: "Opportunity not found." };
  const v = await pursueOpportunity(org.id, opp);
  if (!v) return { ok: false, error: "Couldn't start the venture (apply migration 0013)." };
  return { ok: true };
}

/** Advance a tracked venture to the next lifecycle stage (gated by viability). */
export async function advanceOpportunityAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const v = await getOpportunityRecord(id);
  if (!v || v.orgId !== org.id) return { ok: false, error: "Venture not found." };
  const res = await advanceOpportunity(id);
  return res.ok ? { ok: true } : { ok: false, error: res.reason };
}
