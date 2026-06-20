import { notFound } from "next/navigation";
import { getProposalByToken } from "@/lib/proposals";
import AcceptForm from "./AcceptForm";

/**
 * Public sales proposal (Phase #7). The prospect opens this with their opaque
 * token — no login — to read the scope, price and timeline, and accept. Read
 * server-side via the service role filtered by the exact token (capability-by-
 * token; same model as /preview and /portal). Must 404, never 500. Noindex.
 */
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const proposal = await getProposalByToken(params.token);
  if (!proposal) notFound();

  const accepted = proposal.status === "accepted";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-medium text-indigo-600">Your proposal</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">{proposal.title}</h1>
        <p className="mt-3 text-slate-600">{proposal.summary}</p>
      </header>

      {accepted && (
        <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Thanks — you've accepted this proposal. We'll be in touch to get started right away.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">What's included</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {proposal.deliverables.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-emerald-500">✓</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium text-slate-500">One-off build</span>
          <span className="text-3xl font-semibold text-slate-900">
            {formatPrice(proposal.pricePence)}
          </span>
        </div>
        {proposal.priceNote && (
          <p className="mt-1 text-right text-sm text-slate-500">{proposal.priceNote}</p>
        )}
        {proposal.timeline && (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Timeline:</span> {proposal.timeline}
          </p>
        )}
      </section>

      {!accepted && (
        <section className="mt-8">
          <AcceptForm token={proposal.token} />
        </section>
      )}
    </main>
  );
}
