import Link from "next/link";
import type { Metadata } from "next";
import { SERVICE_PAGES } from "@/lib/seo-content";

export const metadata: Metadata = {
  title: "Website Design by Industry",
  description: "Conversion-focused, SEO-ready websites built for local service businesses — plumbers, electricians, dentists, builders, salons and more.",
  alternates: { canonical: "/websites" },
};

export default function WebsitesHub() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Website design, built for your industry</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Every trade wins customers differently. We build websites around how your customers actually
        search, choose and book — not a one-size-fits-all template.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {SERVICE_PAGES.map((s) => (
          <Link
            key={s.slug}
            href={`/websites/${s.slug}`}
            className="group rounded-2xl border border-slate-200 p-6 transition-colors hover:border-slate-400"
          >
            <h2 className="text-lg font-semibold text-slate-900">Websites for {s.plural}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{s.headline}</p>
            <span className="mt-3 inline-block text-sm font-medium text-slate-500 group-hover:text-slate-900">
              Learn more →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
