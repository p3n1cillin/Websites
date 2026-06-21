import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { brand, PRICING, gbp } from "@/lib/brand";
import { SERVICE_PAGES } from "@/lib/seo-content";
import Reveal from "./Reveal";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const HERO_IMG =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80";
const FACTORY_IMG =
  "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1100&q=80";

const SERVICES = [
  { title: "Conversion-first websites", body: "Fast, mobile-first sites built around one goal: turning local searches into calls, bookings and enquiries." },
  { title: "Local SEO", body: "Structured data, location pages and Google Business setup so nearby customers actually find you." },
  { title: "Lead capture & follow-up", body: "Tap-to-call and quote forms wired to your inbox, with automated follow-up so nothing goes cold." },
  { title: "Care plan & hosting", body: "Fast secure hosting, ongoing edits and performance monitoring on one simple monthly plan." },
];

const STEPS = [
  { k: "01", title: "Audit", body: "We analyse your current site and your local competitors, and show you exactly what's costing you customers." },
  { k: "02", title: "Demo", body: "We build a real preview of your new site before you pay a penny. You see the upgrade, not a pitch." },
  { k: "03", title: "Launch", body: "Approve it and we go live: domain, hosting, SEO and lead capture all wired up and working." },
  { k: "04", title: "Grow", body: "Your care plan keeps the site fast, updated and climbing, with ongoing edits and improvements." },
];

const FAQ = [
  { q: "Who is this for?", a: "Local service businesses (trades, salons, clinics, restaurants and similar) that rely on being found and contacted online." },
  { q: "Do I see it before I pay?", a: "Yes. We build a real demo of your new site first. You only pay the build fee once you're happy to proceed." },
  { q: "What does it cost?", a: `A one-off build from ${gbp(PRICING.buildFromPence)}, then ${gbp(PRICING.carePlanPence)}/month for hosting, updates and support. Cancel the plan anytime.` },
  { q: "Do I own the website?", a: "Yes. The site and content are yours. The monthly plan covers hosting, maintenance and ongoing support." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function MarketingHome() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* HERO — asymmetric split, real image, single message. */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-2 lg:pt-24">
          <div>
            <p className="marketing-fade text-sm font-medium text-emerald-700" style={{ animationDelay: "0ms" }}>
              Web design for local business
            </p>
            <h1 className="marketing-fade font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl" style={{ animationDelay: "80ms" }}>
              Websites that turn local searches into paying customers.
            </h1>
            <p className="marketing-fade mt-5 max-w-md text-lg leading-relaxed text-slate-600" style={{ animationDelay: "160ms" }}>
              We design fast, modern websites for local businesses. You see a real demo of yours before you pay anything.
            </p>
            <div className="marketing-fade mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
              <Link href="/contact" className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 active:translate-y-px">
                Get a free audit
              </Link>
              <Link href="/pricing" className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900">
                See pricing
              </Link>
            </div>
          </div>

          <div className="marketing-fade relative" style={{ animationDelay: "200ms" }}>
            <div className="absolute -right-3 -top-3 hidden h-24 w-24 rounded-2xl bg-emerald-500/15 lg:block" aria-hidden />
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5">
              <Image
                src={HERO_IMG}
                alt="A local business owner reviewing their new website"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
        {/* Trust line — under the hero, not inside it. Honest, no fake logos. */}
        <div className="mx-auto max-w-6xl border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">Built for UK trades, salons, clinics, restaurants and local services.</p>
        </div>
      </section>

      {/* WHAT WE DO — split: anchored heading + real service content (bento rhythm). */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to get found and get booked.
            </h2>
            <p className="mt-4 max-w-sm text-slate-600">
              Not a template. Each site is built around how your customers actually search, choose and contact you.
            </p>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.06}>
                <div className="h-full rounded-2xl border border-slate-200 p-6 transition-colors hover:border-slate-300">
                  <div className="font-display text-sm font-semibold text-emerald-700">0{i + 1}</div>
                  <h3 className="mt-2 font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 4-step row, verb labels (different layout family). */}
      <section id="process" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <Reveal>
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              From invisible to fully booked, in about two weeks.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.k} delay={i * 0.06} className="bg-white">
                <div className="h-full p-6">
                  <div className="font-display text-2xl font-semibold text-slate-300">{s.k}</div>
                  <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES — pill strip linking the SEO landing pages (different family). */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-slate-200">
              <Image src={FACTORY_IMG} alt="Designing a website for a local business" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Built for your industry.
            </h2>
            <p className="mt-4 max-w-md text-slate-600">
              We tailor the site to how customers in your trade search and book. A few of the industries we build for:
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SERVICE_PAGES.map((s) => (
                <Link key={s.slug} href={`/websites/${s.slug}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900">
                  {s.plural}
                </Link>
              ))}
              <Link href="/websites" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
                All industries
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING — two cards (different family). */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Simple, transparent pricing.
            </h2>
            <p className="mt-4 max-w-xl text-slate-600">
              A one-off build fee plus a low monthly care plan. You pay the build only after you approve the demo, and you can cancel the plan anytime.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-8">
                <div className="text-sm text-slate-500">Website build</div>
                <div className="font-display mt-1 text-4xl font-semibold text-slate-900">from {gbp(PRICING.buildFromPence)}</div>
                <p className="mt-1 text-sm text-slate-500">one-off, after you approve the demo</p>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <div className="h-full rounded-2xl border border-emerald-600 bg-white p-8 ring-1 ring-emerald-600">
                <div className="text-sm text-slate-500">Care plan</div>
                <div className="font-display mt-1 text-4xl font-semibold text-slate-900">
                  {gbp(PRICING.carePlanPence)}<span className="text-lg font-normal text-slate-400">/mo</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">hosting, updates and support, cancel anytime</p>
              </div>
            </Reveal>
          </div>
          <div className="mt-8">
            <Link href="/pricing" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              See what&apos;s included →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ — accordion (different family). */}
      <section className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Questions</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                {f.q}
                <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA — one deliberate dark color block. */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center lg:py-28">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              See your new website before you pay anything.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-slate-400">
              We&apos;ll audit your current presence and build a real demo, free.
            </p>
            <div className="mt-8">
              <Link href="/contact" className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 active:translate-y-px">
                Get a free audit
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
