import { requireOrg } from "@/lib/auth";
import { getBusinessesForOrg } from "@/lib/businesses";
import { getExperimentsForOrg } from "@/lib/experiments";
import type { Experiment } from "@/lib/types";
import Growth, { type GrowthBusiness } from "./Growth";

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  const org = await requireOrg();
  const [businesses, experiments] = await Promise.all([
    getBusinessesForOrg(org.id),
    getExperimentsForOrg(org.id),
  ]);

  const live: GrowthBusiness[] = businesses
    .filter((b) => b.status === "published")
    .map((b) => ({ id: b.id, name: b.data.name }));

  const expByBusiness: Record<string, Experiment[]> = {};
  for (const e of experiments) (expByBusiness[e.businessId] ??= []).push(e);

  const running = experiments.filter((e) => e.status === "running").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Growth</h1>
          <p className="mt-1 text-sm text-slate-500">
            A/B test headlines on live sites and publish local SEO articles — continuous improvement.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {live.length} live site{live.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-700">
            {running} test{running === 1 ? "" : "s"} running
          </span>
        </div>
      </div>

      {live.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No live sites yet. Publish a customer site (Businesses → Publish) to run growth experiments
          and generate SEO content.
        </div>
      ) : (
        <Growth businesses={live} expByBusiness={expByBusiness} />
      )}
    </div>
  );
}
