import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand, PRICING, gbp } from "@/lib/brand";
import { SERVICE_PAGES, getServicePage } from "@/lib/seo-content";

/**
 * Industry landing page — /websites/[service]. Statically generated, one per trade,
 * each targeting "website design for {trade}". Distinct content + Service JSON-LD so
 * each is a genuine indexable page (Empire SEO). Drives traffic → /contact.
 */
export const dynamic = "error"; // fully static
export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ service: s.slug }));
}

export function generateMetadata({ params }: { params: { service: string } }): Metadata {
  const page = getServicePage(params.service);
  if (!page) return {};
  const title = `Website Design for ${page.plural}`;
  const description = `${page.headline}. Mobile-first, fast, SEO-ready websites for ${page.plural.toLowerCase()} from ${gbp(PRICING.buildFromPence)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/websites/${page.slug}` },
    openGraph: { title: `${title} | ${brand.name}`, description, type: "website" },
  };
}

export default function ServiceLandingPage({ params }: { params: { service: string } }) {
  const page = getServicePage(params.service);
  if (!page) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `Website design for ${page.plural.toLowerCase()}`,
    provider: { "@type": "ProfessionalService", name: brand.legalName, url: brand.url },
    areaServed: brand.location,
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: (PRICING.buildFromPence / 100).toFixed(0),
      description: "Website build from",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-sm font-medium text-emerald-300">Website design for {page.plural.toLowerCase()}</p>
          <h1 className="font-display mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{page.headline}</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">{page.intro}</p>
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

      {/* Problems */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">What&apos;s costing {page.plural.toLowerCase()} customers</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {page.painPoints.map((p) => (
            <li key={p} className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-700">
              <span className="mr-2 text-red-500">✗</span>{p}
            </li>
          ))}
        </ul>
      </section>

      {/* Outcomes */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">What we build instead</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {page.outcomes.map((o) => (
              <li key={o} className="rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-sm">
                <span className="mr-2 text-emerald-500">✓</span>{o}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing + CTA */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          {page.label} website from {gbp(PRICING.buildFromPence)} + {gbp(PRICING.carePlanPence)}/mo
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          You see a real demo of your new site before you pay anything. Cancel the care plan anytime.
        </p>
        <div className="mt-8">
          <Link href="/contact" className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
            Get your free audit
          </Link>
        </div>

        {/* Internal links to sibling industries — crawlable + keeps users on site. */}
        <div className="mt-14 border-t border-slate-200 pt-8">
          <p className="text-sm font-medium text-slate-500">We also build websites for:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {SERVICE_PAGES.filter((s) => s.slug !== page.slug).map((s) => (
              <Link
                key={s.slug}
                href={`/websites/${s.slug}`}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900"
              >
                {s.plural}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
