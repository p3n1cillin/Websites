import type { Business } from "@/lib/types";
import { Section, Container, Heading } from "@/components/site/primitives";

/**
 * Customer FAQs — universal SEO + conversion win, tailored per industry by the
 * Industry Profiler. Native <details> accordion, so no client JS. Renders only
 * when `business.faqs` is populated.
 */
export default function Faqs({ business }: { business: Business }) {
  const faqs = business.faqs;
  if (!faqs?.length) return null;
  return (
    <Section tone="muted">
      <Container className="max-w-3xl">
        <Heading className="text-3xl sm:text-4xl">Frequently asked questions</Heading>
        <div className="mt-8 divide-y divide-[rgb(var(--border))] border-y border-[rgb(var(--border))]">
          {faqs.map((f) => (
            <details key={f.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[rgb(var(--ink))]">
                {f.question}
                <span className="shrink-0 text-brand transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[rgb(var(--ink-muted))]">{f.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
