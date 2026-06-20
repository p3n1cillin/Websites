import { notFound } from "next/navigation";
import { getActivePortalByToken } from "@/lib/customers";
import { getBusinessRecord } from "@/lib/businesses";
import { getLeadsForBusiness } from "@/lib/leads";
import { getChangeRequestsForBusiness } from "@/lib/change-requests";
import { buildCustomerReport } from "@/lib/reports";
import { SITE_URL } from "@/lib/seo";
import type { ChangeRequestStatus } from "@/lib/types";
import RequestForm from "./RequestForm";

/**
 * Public customer portal (Phase F). The end customer opens this with their opaque
 * token — no login — to see their site's health, view it, and request changes.
 * Read server-side via the service role filtered by the exact token (capability-
 * by-token; see lib/customers). Outside the admin shell + middleware. Noindex.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const CR_BADGE: Record<ChangeRequestStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
  declined: "bg-slate-100 text-slate-500",
};

export default async function PortalPage({ params }: { params: { token: string } }) {
  const portal = await getActivePortalByToken(params.token);
  if (!portal) notFound();

  const record = await getBusinessRecord(portal.businessId);
  if (!record) notFound();

  const [leads, requests] = await Promise.all([
    getLeadsForBusiness(record.id),
    getChangeRequestsForBusiness(record.id),
  ]);
  const report = buildCustomerReport(record.id, record.data, leads);

  const business = record.data;
  const liveUrl = record.customDomain
    ? `https://${record.customDomain}`
    : `${SITE_URL}/${record.slug}`;
  const isLive = record.status === "published";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-indigo-600">Your website portal</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">{business.name}</h1>
        <p className="mt-1 text-slate-500">{business.categoryLabel}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {isLive ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              View your live site ↗
            </a>
          ) : (
            <span className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              Your site is being finalised — we'll let you know the moment it's live.
            </span>
          )}
        </div>
      </header>

      {/* Health report */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">How your site is doing</h2>
        <p className="mt-1 text-slate-600">{report.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Enquiries" value={report.leads.total} />
          <Stat label="New" value={report.leads.new} />
          <Stat label="Won" value={report.leads.won} />
          <Stat label="Site health" value={`${report.qaScore}/100`} />
        </div>
        {report.suggestions.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            {report.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-500">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Change requests */}
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Request a change</h2>
        <p className="mt-1 text-sm text-slate-500">
          Want something updated? Let us know and we'll take care of it.
        </p>
        <div className="mt-4">
          <RequestForm token={portal.token} />
        </div>

        {requests.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">Your requests</h3>
            {requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
                  {r.detail && <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CR_BADGE[r.status]}`}>
                  {r.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
