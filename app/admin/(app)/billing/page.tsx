import { requireOrg } from "@/lib/auth";
import { getInvoicesForOrg } from "@/lib/orgs";
import { PAID_PLANS, orgEntitlement } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";
import type { Invoice } from "@/lib/types";
import { startCheckout, openPortal } from "./actions";

export const dynamic = "force-dynamic";

function fmtMoney(pence: number | null | undefined, currency: string): string {
  if (pence == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  success: { tone: "ok", text: "Subscription active — thank you! It may take a few seconds to reflect." },
  canceled: { tone: "warn", text: "Checkout canceled. No charge was made." },
  stripe: { tone: "warn", text: "Billing isn't configured yet. Add your Stripe keys to enable upgrades." },
  checkout: { tone: "warn", text: "Couldn't start checkout. Please try again." },
  portal: { tone: "warn", text: "Couldn't open the billing portal. Please try again." },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string; error?: string };
}) {
  const org = await requireOrg();
  const entitlement = orgEntitlement(org);
  const invoices = stripeConfigured && org.stripeCustomerId ? await getInvoicesForOrg(org.id) : [];

  const noticeKey = searchParams.success
    ? "success"
    : searchParams.canceled
      ? "canceled"
      : searchParams.error;
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  const trialLeft =
    org.plan === "trial" && org.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your subscription, payment method and invoices.
        </p>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {!stripeConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Stripe isn&apos;t configured. Set <code className="font-mono">STRIPE_SECRET_KEY</code>,{" "}
          <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> and the{" "}
          <code className="font-mono">STRIPE_PRICE_*</code> price ids to enable subscriptions.
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Current plan</div>
            <div className="mt-1 text-xl font-semibold capitalize">{org.plan}</div>
            <p className="mt-1 text-sm text-slate-600">
              {org.plan === "trial" && trialLeft !== null
                ? `Free trial — ${trialLeft} day${trialLeft === 1 ? "" : "s"} left.`
                : entitlement.active
                  ? "Your subscription is active."
                  : entitlement.reason ?? "Your subscription is not active."}{" "}
              Up to {entitlement.businessLimit} published website
              {entitlement.businessLimit === 1 ? "" : "s"}.
            </p>
          </div>
          {stripeConfigured && org.stripeCustomerId && (
            <form action={openPortal}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                Manage billing
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Plan picker */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const current = org.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-6 ${
                current ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="text-lg font-semibold">{plan.price}</div>
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <div className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-medium text-slate-500">
                    Current plan
                  </div>
                ) : (
                  <form action={startCheckout}>
                    <input type="hidden" name="plan" value={plan.id} />
                    <button
                      disabled={!stripeConfigured}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {org.plan === "trial" ? `Choose ${plan.name}` : `Switch to ${plan.name}`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-6 py-4 font-medium">Invoices</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: Invoice) => (
                <tr key={inv.id} className="border-t border-slate-100">
                  <td className="px-6 py-3">{fmtDate(inv.createdAt)}</td>
                  <td className="px-6 py-3">{fmtMoney(inv.amountDue, inv.currency)}</td>
                  <td className="px-6 py-3 capitalize">{inv.status ?? "—"}</td>
                  <td className="px-6 py-3 text-right">
                    {inv.hostedUrl && (
                      <a
                        href={inv.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 underline hover:text-slate-900"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
