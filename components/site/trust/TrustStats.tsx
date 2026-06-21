import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import StarRating from "@/components/StarRating";
import { hasRating } from "@/lib/utils";
import { Container } from "../primitives";

/** Trust variant: bold stat cards on a brand-tinted band. */
export default function TrustStats({ business }: { business: Business; dna: DesignDNA }) {
  const yearsTrading = business.established
    ? new Date().getFullYear() - business.established
    : null;

  const stats: { value: string; label: string; rating?: boolean }[] = [
    // Rating stats only with real reviews (never a fabricated score).
    ...(hasRating(business)
      ? [
          { value: `${business.rating!.value}/5`, label: "Average rating", rating: true },
          { value: `${business.rating!.count}+`, label: "Happy customers" },
        ]
      : []),
    ...(yearsTrading ? [{ value: `${yearsTrading}+`, label: "Years of experience" }] : []),
    { value: `${business.services.length}+`, label: "Services offered" },
    { value: `${business.serviceAreas.length || business.badges.length}+`, label: "Areas covered" },
  ];

  return (
    <section className="bg-brand-light/30 py-10">
      <Container>
        <div className="grid gap-[var(--gap)] sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[var(--radius-lg)] border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-5 py-6 text-center shadow-soft"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-extrabold text-brand">{stat.value}</span>
                {stat.rating && <StarRating value={business.rating!.value} size="h-4 w-4" />}
              </div>
              <div className="mt-1 text-sm font-medium uppercase tracking-wide text-[rgb(var(--ink-muted))]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
