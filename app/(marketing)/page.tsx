import Link from "next/link";
import type { Metadata } from "next";
import { brand, PRICING, gbp } from "@/lib/brand";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Public homepage for the agency — what we do, for whom, how it works, and what it
 * costs. This is the business site Stripe reviews for activation, so it states the
 * product, pricing and contact plainly.
 */

const SERVICES = [
  {
    title: "Conversion-focused websites",
    body: "Fast, mobile-first sites built around one goal: turning local searches into phone calls, bookings and enquiries.",
  },
  {
    title: "Local SEO setup",
    body: "Title tags, structured data, Google Business and location pages so you're found when nearby customers search.",
  },
  {
    title: "Lead capture & follow-up",
    body: "Tap-to-call, quote forms wired to your inbox, and automated follow-up so no enquiry goes cold.",
  },
  {
    title: "Care plan & hosting",
    body: "Fast secure hosting, ongoing updates, edits and performance monitoring on a simple monthly plan.",
  },
];

const STEPS = [
  { n: 1, title: "Free audit", body: "We analyse your current site (or lack of one) and your local competitors, and show you exactly what's costing you customers." },
  { n: 2, title: "See a demo first", body: "We build a real preview of your new site before you pay a penny — you see the upgrade, not a pitch deck." },
  { n: 3, title: "Go live in ~2 weeks", body: "Approve it, we launch it: domain, hosting, SEO and lead capture all wired up and working." },
  { n: 4, title: "Grow every month", body: "Your care plan keeps the site fast, updated and climbing — with ongoing edits and improvements." },
];

const FAQ = [
  { q: "Who is this for?", a: "Local service businesses — trades, salons, clinics, restaurants and similar — who rely on being found and contacted online." },
  { q: "Do I see it before I pay?", a: "Yes. We build a real demo of your new site first. You only pay the build fee once you're happy to proceed." },
  { q: "What does it cost?", a: `A one-off build from ${gbp(PRICING.buildFromPence)}, then ${gbp(PRICING.carePlanPence)}/month for hosting, updates and support. Cancel the plan anytime.` },
  { q: "Do I own the website?", a: "Yes — the site and content are yours. The monthly plan covers hosting, maintenance and ongoing support." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function MarketingHome() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 400px at 75% -10%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(600px 400px at 10% 110%, rgba(16,185,129,0.25), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
          <p className="text-sm font-medium text-indigo-300">{brand.name}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {brand.tagline}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">
            We design and build modern websites for local businesses — and you see a real demo of
            yours before you pay anything.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              Get your free audit
            </Link>
            <Link href="/pricing" className="rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">What we do</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Everything a local business needs to get found online and turn visitors into customers.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section id="process" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Simple, transparent pricing</h2>
              <p className="mt-2 max-w-xl text-slate-600">
                A one-off build fee plus a low monthly care plan. No long contracts — cancel the plan anytime.
              </p>
            </div>
            <Link href="/pricing" className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Full pricing →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="text-sm text-slate-500">Website build</div>
              <div className="mt-1 text-3xl font-semibold">from {gbp(PRICING.buildFromPence)}</div>
              <div className="text-sm text-slate-500">one-off · pay after you approve the demo</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-6">
              <div className="text-sm text-slate-500">Care plan</div>
              <div className="mt-1 text-3xl font-semibold">{gbp(PRICING.carePlanPence)}<span className="text-base font-normal text-slate-400">/mo</span></div>
              <div className="text-sm text-slate-500">hosting, updates &amp; support · cancel anytime</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-8 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl bg-white p-6">
                <dt className="font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-2 text-sm text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 text-center">
            <Link href="/contact" className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Get your free audit
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
