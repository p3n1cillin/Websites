import Link from "next/link";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import {
  heroRegistry,
  trustRegistry,
  servicesRegistry,
  testimonialsRegistry,
  ctaRegistry,
} from "@/components/site/registry";
import { Section, Container, Eyebrow, Heading } from "@/components/site/primitives";
import Highlights from "@/components/site/sections/Highlights";
import Faqs from "@/components/site/sections/Faqs";
import Menu from "@/components/site/sections/Menu";
import OpeningHours from "@/components/OpeningHours";
import MapEmbed from "@/components/MapEmbed";
import Reveal from "@/components/Reveal";
import { CheckIcon, ArrowRightIcon } from "@/components/Icons";

/**
 * The home-page section stack, rendered from a Business × DesignDNA. The DNA picks
 * which variant fills each section slot — so two businesses get structurally
 * different homepages. Shared by the live route (app/[business]/page.tsx) and the
 * Website Factory preview so what you preview is exactly what ships.
 */
export default function HomeSections({
  business,
  dna,
}: {
  business: Business;
  dna: DesignDNA;
}) {
  const Hero = heroRegistry[dna.layout.hero];
  const Trust = trustRegistry[dna.layout.trust];
  const Services = servicesRegistry[dna.layout.services];
  const Testimonials = testimonialsRegistry[dna.layout.testimonials];
  const Cta = ctaRegistry[dna.layout.cta];

  return (
    <>
      <Hero business={business} dna={dna} />
      <Trust business={business} dna={dna} />
      <Services business={business} dna={dna} />

      {/* Industry-specific sections — render only when the Business carries the data. */}
      <Highlights business={business} />
      <Menu business={business} />

      {/* About + why-choose-us preview with internal links (shared across all DNA). */}
      <Section tone="muted">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal from="right">
            <Eyebrow>Why {business.address.city} chooses us</Eyebrow>
            <Heading className="mt-2 text-3xl sm:text-4xl">
              Local, trusted and{" "}
              {business.established
                ? `${new Date().getFullYear() - business.established} years`
                : "years"}{" "}
              of experience
            </Heading>
            <p className="mt-4 text-[rgb(var(--ink-muted))]">
              {business.about.split("\n\n")[0]}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {business.badges.map((badge) => (
                <li key={badge} className="flex items-center gap-2.5 text-[rgb(var(--ink))]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{badge}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/${business.slug}/about`}
              className="mt-7 inline-flex items-center gap-1.5 text-base font-semibold text-brand hover:gap-2.5"
            >
              More about {business.name}
              <ArrowRightIcon className="h-5 w-5 transition-all" />
            </Link>
          </Reveal>

          <Reveal from="left" className="grid gap-6">
            <OpeningHours business={business} />
            <div className="rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[rgb(var(--ink))]">
                Proudly serving {business.address.city}
              </h3>
              <p className="mt-1 text-sm text-[rgb(var(--ink-muted))]">
                We cover {business.address.city} and the surrounding areas:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {business.serviceAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-[var(--radius-pill)] bg-brand-light/50 px-3 py-1 text-sm font-medium text-brand-dark"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Testimonials business={business} dna={dna} />

      <Faqs business={business} />

      {/* Map + contact prompt (shared across all DNA). */}
      <Section tone="surface">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Heading className="text-3xl sm:text-4xl">Find us in {business.address.city}</Heading>
            <p className="mt-4 text-[rgb(var(--ink-muted))]">
              Based in the heart of {business.address.city}, we&apos;re never far away. Pop in, call
              us, or send an enquiry and we&apos;ll get back to you quickly.
            </p>
            <Link
              href={`/${business.slug}/contact`}
              className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03]"
            >
              Get in touch
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </Reveal>
          <Reveal from="left">
            <MapEmbed business={business} />
          </Reveal>
        </Container>
      </Section>

      <Cta business={business} dna={dna} />
    </>
  );
}
