import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import Reveal from "@/components/Reveal";
import StarRating from "@/components/StarRating";
import { Section, Container, Eyebrow, Heading } from "../primitives";

/** Testimonials variant: one large featured quote with a strip of supporting voices. */
export default function TestimonialsQuote({ business }: { business: Business; dna: DesignDNA }) {
  const [featured, ...rest] = [...business.testimonials].sort((a, b) => b.rating - a.rating);

  return (
    <Section tone="muted">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Reviews</Eyebrow>
          <Heading className="mt-2 text-3xl sm:text-4xl">
            What {business.address.city} says about us
          </Heading>
        </div>

        {/* Never fabricate reviews — labelled placeholder when there are none yet. */}
        {!featured && (
          <div className="mx-auto mt-10 max-w-xl rounded-[var(--radius-lg)] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center">
            <p className="text-base font-semibold text-[rgb(var(--ink))]">
              Your customer reviews appear here
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--ink-muted))]">
              Add 2–3 real reviews from happy {business.address.city} customers and they&apos;ll show
              in this section.
            </p>
          </div>
        )}

        {featured && (
          <>

        <Reveal className="mx-auto mt-10 max-w-3xl rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center shadow-soft sm:p-12">
          <StarRating value={featured.rating} size="h-6 w-6" className="justify-center" />
          <blockquote
            style={{ fontFamily: "var(--font-heading)" }}
            className="mt-6 text-2xl font-semibold leading-snug text-[rgb(var(--ink))] sm:text-3xl"
          >
            “{featured.quote}”
          </blockquote>
          <footer className="mt-6 text-sm font-semibold text-[rgb(var(--ink-muted))]">
            {featured.author}
            {featured.location ? ` · ${featured.location}` : ""}
          </footer>
        </Reveal>

        {rest.length > 0 && (
          <div className="mx-auto mt-6 grid max-w-4xl gap-[var(--gap)] sm:grid-cols-2">
            {rest.slice(0, 2).map((t, i) => (
              <Reveal
                as="article"
                key={t.author}
                delay={i * 0.08}
                className="rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-sm"
              >
                <StarRating value={t.rating} size="h-4 w-4" />
                <blockquote className="mt-3 text-[rgb(var(--ink-muted))]">“{t.quote}”</blockquote>
                <footer className="mt-4 text-sm font-semibold text-[rgb(var(--ink))]">
                  {t.author}
                </footer>
              </Reveal>
            ))}
          </div>
        )}
          </>
        )}
      </Container>
    </Section>
  );
}
