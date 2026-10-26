import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SEO_TRADES, getTradeBySlug } from "@/lib/kit/seo-trades";
import OrderForm from "../OrderForm";

interface Props {
  params: Promise<{ trade: string }>;
}

export async function generateStaticParams() {
  return SEO_TRADES.map((t) => ({ trade: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trade: tradeSlug } = await params;
  const trade = getTradeBySlug(tradeSlug);
  if (!trade) return { title: "Trade Not Found" };

  return {
    title: `Google Business Profile Kit for ${trade.plural} — 52 Weekly Posts & SEO Kit`,
    description: `Complete Google Business Profile kit for UK ${trade.plural.toLowerCase()}: 52 dated weekly posts, 750-char description, review templates, and Q&As from £19.`,
    alternates: { canonical: `/map-pack-kit/${trade.slug}` },
  };
}

export default async function TradeKitPage({ params }: Props) {
  const { trade: tradeSlug } = await params;
  const trade = getTradeBySlug(tradeSlug);
  if (!trade) notFound();

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Map Pack Kit for ${trade.plural}`,
    description: trade.subheading,
    offers: [
      {
        "@type": "Offer",
        name: "Starter Kit",
        price: "19.00",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Complete Kit",
        price: "29.00",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
      },
    ],
  };

  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {/* Hero */}
      <section className="border-b border-slate-200 bg-slate-50 py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800">
            Dedicated Toolkit for UK {trade.plural}
          </div>

          <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {trade.headline}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 leading-relaxed">
            {trade.subheading}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#order"
              className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow hover:bg-slate-800 active:scale-95 transition"
            >
              Order Your {trade.singular} Kit from £19
            </a>
            <Link
              href="/kit/sample"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Inspect Live Sample Kit →
            </Link>
          </div>
        </div>
      </section>

      {/* Trade Specific Context */}
      <section className="py-16 mx-auto max-w-5xl px-6">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Services Box */}
          <div className="rounded-2xl border border-slate-200 p-6 bg-white">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Services Optimised for {trade.plural}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Your kit includes specific keyword-rich descriptions for high-value services:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {trade.typicalServices.map((svc) => (
                <li key={svc} className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{svc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sample Post Box */}
          <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">Example Weekly Post</h2>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {trade.samplePost.type}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-slate-900 text-sm">{trade.samplePost.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 italic">
              &ldquo;{trade.samplePost.body}&rdquo;
            </p>
            <div className="mt-3 text-xs font-medium text-slate-500">
              Recommended CTA button: <span className="text-slate-900 font-bold">{trade.samplePost.cta}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Order Form */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-4xl px-6">
          <OrderForm defaultTrade={trade.singular} />
        </div>
      </section>

      {/* Navigation across other trades */}
      <section className="py-16 mx-auto max-w-5xl px-6 border-t border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-center">
          Other Trade Kits Available
        </h3>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SEO_TRADES.filter((t) => t.slug !== trade.slug).map((t) => (
            <Link
              key={t.slug}
              href={`/map-pack-kit/${t.slug}`}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition"
            >
              {t.plural}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
