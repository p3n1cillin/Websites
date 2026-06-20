import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import Reveal from "@/components/Reveal";
import { Container, Heading, CallButton, ActionButton } from "../primitives";

/** CTA variant: full-bleed brand band, copy left + actions right. */
export default function CtaSplit({ business }: { business: Business; dna: DesignDNA }) {
  return (
    <section className="bg-brand py-[var(--section-y)] text-brand-fg">
      <Container>
        <Reveal className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <Heading className="text-brand-fg sm:text-4xl">
              {`Need a ${business.primaryService.toLowerCase()} in ${business.address.city}?`}
            </Heading>
            <p className="mt-3 text-lg text-brand-fg/90">
              Friendly local service and no-obligation quotes. Get in touch today and we&apos;ll get
              back to you fast.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <CallButton business={business} variant="light" />
            <ActionButton business={business} tone="light" />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
