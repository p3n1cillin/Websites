import Link from "next/link";
import type { Business } from "@/lib/types";
import JsonLd from "./JsonLd";
import { breadcrumbJsonLd, type PageKind } from "@/lib/seo";

/**
 * Consistent inner-page header with a brand-tinted band and a breadcrumb (also
 * emitted as BreadcrumbList JSON-LD for SEO + internal linking).
 */
export default function PageHeader({
  business,
  page,
  title,
  subtitle,
}: {
  business: Business;
  page: PageKind;
  title: string;
  subtitle?: string;
}) {
  const crumbLabel =
    page === "book" ? "Book Online" : page[0].toUpperCase() + page.slice(1);

  return (
    <section className="relative overflow-hidden bg-brand-dark">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/30 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <JsonLd data={breadcrumbJsonLd(business, page)} />
        <nav aria-label="Breadcrumb" className="text-sm text-white/70">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href={`/${business.slug}`} className="hover:text-white">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-white">{crumbLabel}</li>
          </ol>
        </nav>
        <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-lg text-white/85">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
