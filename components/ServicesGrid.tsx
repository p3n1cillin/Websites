import Link from "next/link";
import type { Business, Service } from "@/lib/types";
import Reveal from "./Reveal";
import { ServiceIconSvg, ArrowRightIcon } from "./Icons";

interface ServicesGridProps {
  business: Business;
  /** Limit cards shown (e.g. on the homepage). */
  limit?: number;
  heading?: string;
  subheading?: string;
  /** Show a "View all services" link when limited. */
  showViewAll?: boolean;
  /** Label for the view-all link (defaults to a trade-style "View all services"). */
  viewAllLabel?: string;
}

function ServiceCard({
  business,
  service,
  index,
}: {
  business: Business;
  service: Service;
  index: number;
}) {
  return (
    <Reveal
      as="article"
      delay={(index % 3) * 0.08}
      className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-soft"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light/50 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-fg">
        <ServiceIconSvg name={service.icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-gray-900">{service.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
        {service.description}
      </p>
      <div className="mt-5 flex items-center justify-between">
        {service.price && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
            {service.price}
          </span>
        )}
        <Link
          href={`/${business.slug}/contact`}
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100"
        >
          Enquire
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </Reveal>
  );
}

export default function ServicesGrid({
  business,
  limit,
  heading,
  subheading,
  showViewAll = false,
  viewAllLabel,
}: ServicesGridProps) {
  const services = limit ? business.services.slice(0, limit) : business.services;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      {(heading || subheading) && (
        <Reveal className="mx-auto max-w-2xl text-center">
          {heading && (
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="mt-4 text-lg text-gray-600">{subheading}</p>
          )}
        </Reveal>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, i) => (
          <ServiceCard
            key={service.name}
            business={business}
            service={service}
            index={i}
          />
        ))}
      </div>

      {showViewAll && (
        <Reveal className="mt-10 text-center">
          <Link
            href={`/${business.slug}/services`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03]"
          >
            {viewAllLabel ?? `View all ${business.primaryService.toLowerCase()} services`}
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </Reveal>
      )}
    </section>
  );
}
