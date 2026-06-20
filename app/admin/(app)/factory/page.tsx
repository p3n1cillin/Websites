import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { getBusinessRecord, getBusinessesForOrg } from "@/lib/businesses";
import { buildDna, candidateSeed } from "@/lib/design/dna";
import { getPersonality, personalityForCategory } from "@/lib/design/personalities";
import { LAYOUT_SLOTS, variantCandidates } from "@/lib/design/variants";
import type { DesignLayout } from "@/lib/design/types";
import FactoryWorkspace, { type Candidate } from "./Workspace";

export const dynamic = "force-dynamic";

/** Number of alternative designs generated for side-by-side comparison. */
const CANDIDATE_COUNT = 3;

export default async function FactoryPage({
  searchParams,
}: {
  searchParams: { business?: string };
}) {
  const org = await requireOrg();
  const businessId = searchParams.business;

  // No business chosen yet → the brief step: pick which site to design.
  if (!businessId) {
    const businesses = await getBusinessesForOrg(org.id);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Website Factory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate a unique design, compare options side by side, run the QA gate, then ship it.
          </p>
        </div>

        {businesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            No businesses yet.{" "}
            <Link href="/admin/businesses/new" className="font-medium text-slate-900 underline">
              Create one
            </Link>{" "}
            to design its site.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {businesses.map((biz) => (
                <li key={biz.id}>
                  <Link
                    href={`/admin/factory?business=${biz.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium">{biz.data.name}</span>
                      <span className="ml-2 text-xs text-slate-400">/{biz.slug}</span>
                    </span>
                    <span className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="capitalize">{biz.category}</span>
                      {biz.data.design && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          design saved
                        </span>
                      )}
                      <span aria-hidden>→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // A business is chosen → the design workspace.
  const record = await getBusinessRecord(businessId);
  if (!record || record.orgId !== org.id) redirect("/admin/factory");
  const business = record.data;

  const personality = personalityForCategory(business.category);
  const preset = getPersonality(personality);

  // The on-brief candidate variants per slot — the client cycles within these.
  const slotCandidates: Record<string, string[]> = {};
  for (const slot of LAYOUT_SLOTS) {
    slotCandidates[slot] = variantCandidates(personality, slot) as string[];
  }

  // N deterministic candidate designs (different seeds → different genomes).
  const candidates: Candidate[] = Array.from({ length: CANDIDATE_COUNT }, (_, i) => {
    const seed = candidateSeed(business, i);
    return { seed, layout: buildDna(business, { seed }).layout as DesignLayout };
  });

  return (
    <FactoryWorkspace
      businessId={record.id}
      businessName={business.name}
      businessSlug={business.slug}
      hasSavedDesign={Boolean(business.design)}
      personalityLabel={preset.label}
      slotCandidates={slotCandidates}
      slots={LAYOUT_SLOTS as string[]}
      candidates={candidates}
    />
  );
}
