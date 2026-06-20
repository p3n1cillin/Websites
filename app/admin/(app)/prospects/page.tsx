import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getPreviewsForOrg } from "@/lib/previews";
import { getPreviewStatsForOrg } from "@/lib/preview-analytics";
import { getOutreachForOrg } from "@/lib/outreach";
import { getPortalsForOrg } from "@/lib/customers";
import { getProposalsForOrg } from "@/lib/proposals";
import { SITE_URL } from "@/lib/seo";
import { BUSINESS_CATEGORIES, type OutreachMessage, type Proposal, type SitePreview } from "@/lib/types";
import { buildBusinessGraph } from "@/lib/discovery-graph";
import Board from "./Board";
import {
  createProspectAction,
  discoverAction,
  discoverLiveAction,
  discoverCampaignAction,
} from "./actions";

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

export const dynamic = "force-dynamic";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { found?: string; seen?: string };
}) {
  const org = await requireOrg();
  const found = searchParams?.found;
  const seen = searchParams?.seen;
  const [prospects, previews, outreach, portals, proposals, previewStats] = await Promise.all([
    getProspectsForOrg(org.id),
    getPreviewsForOrg(org.id),
    getOutreachForOrg(org.id),
    getPortalsForOrg(org.id),
    getProposalsForOrg(org.id),
    getPreviewStatsForOrg(org.id),
  ]);

  // Portal URL per onboarded prospect (so won cards link straight in).
  const portalUrlByProspect: Record<string, string> = {};
  for (const portal of portals) {
    if (portal.prospectId && portal.status === "active") {
      portalUrlByProspect[portal.prospectId] = `${SITE_URL}/portal/${portal.token}`;
    }
  }

  // Latest active preview per prospect (previews come back newest-first).
  const previewByProspect: Record<string, SitePreview> = {};
  for (const pv of previews) {
    if (pv.status === "active" && !previewByProspect[pv.prospectId]) {
      previewByProspect[pv.prospectId] = pv;
    }
  }
  // All messages grouped per prospect (also newest-first).
  const outreachByProspect: Record<string, OutreachMessage[]> = {};
  for (const m of outreach) {
    (outreachByProspect[m.prospectId] ??= []).push(m);
  }
  // Latest proposal per prospect (proposals come back newest-first).
  const proposalByProspect: Record<string, Proposal> = {};
  for (const pr of proposals) {
    if (!proposalByProspect[pr.prospectId]) proposalByProspect[pr.prospectId] = pr;
  }

  const open = prospects.filter((p) => p.status !== "won" && p.status !== "lost");
  const pipelineValue = open.reduce((sum, p) => sum + p.valueEstimate, 0);
  const won = prospects.filter((p) => p.status === "won").length;

  // Business graph — rank (industry × town) clusters by domination potential.
  const graph = buildBusinessGraph(prospects);
  const topClusters = graph.clusters.filter((c) => c.size >= 2).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prospects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Outbound targets to win — discover, score the opportunity, and move them down the pipeline.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {prospects.length} total
          </span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 font-medium text-indigo-700">
            £{Math.round(pipelineValue / 100)} open pipeline
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            {won} won
          </span>
        </div>
      </div>

      {found !== undefined && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            found === "0" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {found !== "0"
            ? `Discovered ${found} new local business${found === "1" ? "" : "es"} — analyse them to score the opportunity.`
            : seen && seen !== "0"
              ? `Found ${seen} business${seen === "1" ? "" : "es"} nearby, but they're already in your pipeline — try a different area.`
              : "No businesses found there — try a larger area, a nearby town, or check the spelling."}
        </p>
      )}

      {/* Live discovery — pull real local businesses from OpenStreetMap. */}
      <form
        action={discoverLiveAction}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4"
      >
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-800">Discover nearby businesses (live)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Finds real local businesses from OpenStreetMap and scores the opportunity automatically.
          </p>
        </div>
        <label className="text-xs text-slate-600">
          Area / town
          <input
            name="area"
            defaultValue="Warrington"
            className="mt-1 block w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          How many
          <input
            name="limit"
            type="number"
            min={1}
            max={60}
            defaultValue={25}
            className="mt-1 block w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Find businesses
        </button>
      </form>

      {/* Discover at scale — fan out across many towns × services. */}
      <form
        action={discoverCampaignAction}
        className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Discover at scale (campaign)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Sweeps every town × service across both free OSM streams (Overpass + keyword), merges and
            dedups. Leave services blank for a broad sweep of each town.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-600">
            Towns / areas (one per line)
            <textarea
              name="areas"
              rows={4}
              defaultValue={"Warrington\nWidnes\nRuncorn"}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Services (optional, one per line)
            <textarea
              name="categories"
              rows={4}
              placeholder={"plumber\ndentist\nbarber"}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-col justify-between">
            <label className="text-xs text-slate-600">
              Per query
              <input
                name="perQueryLimit"
                type="number"
                min={1}
                max={60}
                defaultValue={25}
                className="mt-1 block w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
              Run campaign
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Runs politely (~1 query/sec) to respect free OSM limits — a big sweep can take a minute.
        </p>
      </form>

      {/* Opportunity clusters — the business graph: which industry×town pockets to own. */}
      {topClusters.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Opportunity clusters</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {graph.totalNodes} businesses · {graph.totalCompetitorEdges.toLocaleString("en-GB")} competitor links.
                Ranked by domination potential (opportunity + digital whitespace + size).
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topClusters.map((c) => (
              <div key={c.key} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-slate-800">
                    {c.category} · {c.city}
                  </span>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                    {c.dominationScore}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.size} businesses · {c.whitespacePct}% weak/no site · {gbp(c.addressableValuePence)} potential
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(3, c.dominationScore)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Intake: add one, or discover many from a pasted list. */}
      <div className="grid gap-4 md:grid-cols-2">
        <form
          action={createProspectAction}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-slate-700">Add a prospect</h2>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="name"
              required
              placeholder="Business name"
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="category"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize"
            >
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              name="city"
              placeholder="City / town"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="phone"
              placeholder="Phone (optional)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="website"
              placeholder="Website (optional)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="email"
              type="email"
              placeholder="Email (optional)"
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Add prospect
          </button>
        </form>

        <form
          action={discoverAction}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-slate-700">Discover many</h2>
          <p className="text-xs text-slate-500">
            Paste one business per line — fields are detected automatically:
            <br />
            <code className="text-slate-400">Name, category, town, website, phone</code>
          </p>
          <textarea
            name="list"
            rows={5}
            placeholder={"Smith & Sons Plumbing, plumber, Warrington\nLatchford Dental, dentist, Latchford, latchforddental.co.uk"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100">
            Discover &amp; score
          </button>
        </form>
      </div>

      {prospects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No prospects yet. Add one above or paste a list to discover and score them.
        </div>
      ) : (
        <Board
          prospects={prospects}
          previewByProspect={previewByProspect}
          outreachByProspect={outreachByProspect}
          portalUrlByProspect={portalUrlByProspect}
          proposalByProspect={proposalByProspect}
          previewStats={previewStats}
          siteUrl={SITE_URL}
        />
      )}
    </div>
  );
}
