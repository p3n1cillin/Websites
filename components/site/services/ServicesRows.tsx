import Link from "next/link";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import Reveal from "@/components/Reveal";
import { ServiceIconSvg, ArrowRightIcon } from "@/components/Icons";
import { Section, Container, Eyebrow, Heading } from "../primitives";

/** Services variant: a numbered, full-width list — calmer, editorial feel. */
export default function ServicesRows({ business }: { business: Business; dna: DesignDNA }) {
  const services = business.services.slice(0, 6);
  return (
    <Section tone="surface">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>What we do</Eyebrow>
          <Heading className="mt-2 text-3xl sm:text-4xl">
            {`Our ${business.primaryService.toLowerCase()} services`}
          </Heading>
          <p className="mt-4 text-lg text-[rgb(var(--ink-muted))]">
            {`Trusted ${business.categoryLabel.toLowerCase()} services across ${business.address.city} and the surrounding areas.`}
          </p>
        </div>

        <ul className="mt-10 divide-y divide-[rgb(var(--border))] border-y border-[rgb(var(--border))]">
          {services.map((service, i) => (
            <Reveal as="li" key={service.name} delay={(i % 4) * 0.06}>
              <Link
                href={`/${business.slug}/contact`}
                className="group flex items-center gap-5 py-5 transition-colors hover:bg-[rgb(var(--surface-muted))]"
              >
                <span className="hidden w-10 shrink-0 text-2xl font-extrabold text-brand/40 sm:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-brand-light/50 text-brand">
                  <ServiceIconSvg name={service.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-[rgb(var(--ink))]">{service.name}</span>
                  <span className="block truncate text-sm text-[rgb(var(--ink-muted))]">
                    {service.description}
                  </span>
                </span>
                {service.price && (
                  <span className="hidden shrink-0 rounded-[var(--radius-pill)] bg-[rgb(var(--surface-muted))] px-3 py-1 text-sm font-semibold text-[rgb(var(--ink))] sm:inline">
                    {service.price}
                  </span>
                )}
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-brand transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href={`/${business.slug}/services`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03]"
          >
            View all {business.primaryService.toLowerCase()} services
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </Container>
    </Section>
  );
}
