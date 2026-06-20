import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import StarRating from "@/components/StarRating";
import { CheckIcon } from "@/components/Icons";
import { hasRating } from "@/lib/utils";
import { Container } from "../primitives";

/** Trust variant: accreditation chips + a rating line — credentials-forward. */
export default function TrustBadges({ business }: { business: Business; dna: DesignDNA }) {
  return (
    <section className="border-y border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-8">
      <Container className="flex flex-col items-center justify-between gap-6 sm:flex-row">
        {hasRating(business) ? (
          <div className="flex items-center gap-3">
            <StarRating value={business.rating!.value} size="h-5 w-5" />
            <span className="text-sm text-[rgb(var(--ink-muted))]">
              <strong className="text-[rgb(var(--ink))]">{business.rating!.value}/5</strong> from{" "}
              {business.rating!.count}+ {business.address.city} reviews
            </span>
          </div>
        ) : (
          <div className="text-sm font-semibold text-[rgb(var(--ink))]">
            Trusted local {business.primaryService.toLowerCase()} in {business.address.city}
          </div>
        )}
        <ul className="flex flex-wrap items-center justify-center gap-2.5">
          {business.badges.map((badge) => (
            <li
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[rgb(var(--border))] bg-[rgb(var(--surface-muted))] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--ink))]"
            >
              <CheckIcon className="h-4 w-4 text-brand" />
              {badge}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
