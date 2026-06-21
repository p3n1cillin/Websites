import Link from "next/link";
import type { Metadata } from "next";
import { PRICING, gbp } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent website pricing — a one-off build fee plus a low monthly care plan. Cancel anytime.",
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Bespoke, mobile-first website designed around your customers",
  "Local SEO setup (titles, structured data, location pages)",
  "Lead capture — call buttons and quote forms wired to your inbox",
  "Google Business and maps integration",
  "Fast, secure hosting with SSL",
];

const PLAN = [
  "Hosting, SSL and daily backups",
  "Ongoing edits and content updates",
  "Performance and uptime monitoring",
  "Priority support",
  "Cancel anytime",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        One simple structure: a one-off build fee, then a low monthly care plan. You see a real demo
        of your site before you pay the build fee, and you can cancel the care plan at any time.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 p-8">
          <h2 className="text-lg font-semibold">Website build</h2>
          <div className="mt-2 text-4xl font-semibold">from {gbp(PRICING.buildFromPence)}</div>
          <p className="mt-1 text-sm text-slate-500">one-off — payable after you approve the demo</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span>{i}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-900 p-8 ring-1 ring-slate-900">
          <h2 className="text-lg font-semibold">Care plan</h2>
          <div className="mt-2 text-4xl font-semibold">
            {gbp(PRICING.carePlanPence)}<span className="text-lg font-normal text-slate-400">/month</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">keeps your site live, fast and improving</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {PLAN.map((i) => (
              <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Final build pricing depends on scope (number of pages and features) and is confirmed in a
        written proposal before any payment. All prices in GBP and include applicable taxes where required.
      </p>

      <div className="mt-10">
        <Link href="/contact" className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          Get a quote
        </Link>
      </div>
    </div>
  );
}
