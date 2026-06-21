import type { Business } from "@/lib/types";
import { Section, Container, Heading } from "@/components/site/primitives";
import Reveal from "@/components/Reveal";
import { offerCopy } from "@/lib/site-copy";

/**
 * Industry-specific feature grid (practice areas, treatments, product categories,
 * specialties — whatever the Industry Profiler decided this business needs). Renders
 * only when `business.highlights` is populated. Token-themed like the rest of the site.
 */
export default function Highlights({ business }: { business: Business }) {
  const h = business.highlights;
  if (!h?.items?.length) return null;
  return (
    <Section tone="surface">
      <Container>
        <div className="max-w-2xl">
          <Heading className="text-3xl sm:text-4xl">
            {h.heading ?? offerCopy(business).heading}
          </Heading>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {h.items.map((item) => (
            <Reveal key={item.title}>
              <div className="h-full rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-soft">
                <div className="mb-4 h-1 w-10 rounded-full bg-brand" />
                <h3 className="text-lg font-bold text-[rgb(var(--ink))]">{item.title}</h3>
                <p className="mt-2 text-[rgb(var(--ink-muted))]">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
