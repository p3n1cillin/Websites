import Link from "next/link";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import Reveal from "@/components/Reveal";
import { ServiceIconSvg, ArrowRightIcon } from "@/components/Icons";
import { Section, Container, Eyebrow, Heading } from "../primitives";
import { offerCopy } from "@/lib/site-copy";

/** Services variant: large two-column feature blocks on a muted surface. */
export default function ServicesFeature({ business }: { business: Business; dna: DesignDNA }) {
  const services = business.services.slice(0, 4);
  const copy = offerCopy(business);
  return (
    <Section tone="muted">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Heading className="mt-2 text-3xl sm:text-4xl">{copy.heading}</Heading>
          <p className="mt-4 text-lg text-[rgb(var(--ink-muted))]">{copy.subheading}</p>
        </div>

        <div className="mt-12 grid gap-[var(--gap)] sm:grid-cols-2">
          {services.map((service, i) => (
            <Reveal
              as="article"
              key={service.name}
              delay={(i % 2) * 0.08}
              className="flex gap-5 rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-7 shadow-sm"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius)] bg-brand text-brand-fg">
                <ServiceIconSvg name={service.icon} className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-[rgb(var(--ink))]">{service.name}</h3>
                <p className="mt-2 text-[rgb(var(--ink-muted))]">{service.description}</p>
                <div className="mt-4 flex items-center gap-3">
                  {service.price && (
                    <span className="rounded-[var(--radius-pill)] bg-brand-light/50 px-3 py-1 text-sm font-semibold text-brand-dark">
                      {service.price}
                    </span>
                  )}
                  <Link
                    href={`/${business.slug}/contact`}
                    className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand"
                  >
                    Enquire
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href={`/${business.slug}/services`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03]"
          >
            {copy.viewAll}
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </Container>
    </Section>
  );
}
