import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import StarRating from "@/components/StarRating";
import { hasRating } from "@/lib/utils";
import { Container, CallButton, ActionButton } from "../primitives";
import ExperimentText from "../ExperimentText";

/** Hero variant: typographic, image-free. Big statement + brand accent rule. */
export default function HeroMinimal({
  business,
  dna,
}: {
  business: Business;
  dna: DesignDNA;
}) {
  const lively = dna.motion === "lively";
  return (
    <section className="bg-[rgb(var(--surface))] py-[var(--section-y)]">
      <Container className={lively ? "animate-fade-up" : ""}>
        <div className="h-1 w-16 rounded-full bg-brand" />
        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[rgb(var(--ink-muted))]">
          {hasRating(business) ? (
            <>
              <StarRating value={business.rating!.value} size="h-4 w-4" />
              <span>
                Rated {business.rating!.value}/5 by {business.rating!.count}+ customers in {business.address.city}
              </span>
            </>
          ) : (
            <span>Trusted local {business.primaryService.toLowerCase()} in {business.address.city}</span>
          )}
        </div>

        <h1
          style={{ fontFamily: "var(--font-heading)" }}
          className="mt-5 max-w-4xl text-5xl font-extrabold leading-[1.04] tracking-tight text-[rgb(var(--ink))] sm:text-6xl lg:text-7xl"
        >
          {business.categoryLabel}
          <br />
          <span className="text-brand">in {business.address.city}.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-[rgb(var(--ink-muted))]">
          <ExperimentText businessSlug={business.slug} slot="headline">
            {business.tagline}
          </ExperimentText>
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CallButton business={business} />
          <ActionButton business={business} tone="outline" />
        </div>
      </Container>
    </section>
  );
}
