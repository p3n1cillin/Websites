import type { Business } from "@/lib/types";
import { Section, Container, Eyebrow, Heading } from "@/components/site/primitives";
import Reveal from "@/components/Reveal";

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
          <Eyebrow>What we offer</Eyebrow>
          <Heading className="mt-2 text-3xl sm:text-4xl">
            {h.heading ?? `Our ${business.primaryService.toLowerCase()} services`}
          </Heading>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {h.items.map((item) => (
            <Reveal key={item.title}>
              <div className="h-full rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm">
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
