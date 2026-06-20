import Image from "next/image";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import StarRating from "@/components/StarRating";
import { CheckIcon } from "@/components/Icons";
import { hasRating, heroImageFor } from "@/lib/utils";
import { BLUR_DATA_URL } from "@/lib/images";
import { Container, CallButton, ActionButton } from "../primitives";
import ExperimentText from "../ExperimentText";

/** Hero variant: typographic statement paired with a framed photo. */
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
      <Container
        className={`grid items-center gap-12 lg:grid-cols-2 ${lively ? "animate-fade-up" : ""}`}
      >
        <div>
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
            className="mt-5 text-5xl font-extrabold leading-[1.04] tracking-tight text-[rgb(var(--ink))] sm:text-6xl"
          >
            {business.categoryLabel}
            <br />
            <span className="text-brand">in {business.address.city}.</span>
          </h1>

          <p className="mt-6 max-w-xl text-xl leading-relaxed text-[rgb(var(--ink-muted))]">
            <ExperimentText businessSlug={business.slug} slot="headline">
              {business.tagline}
            </ExperimentText>
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CallButton business={business} />
            <ActionButton business={business} tone="outline" />
          </div>

          {business.badges.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {business.badges.slice(0, 3).map((badge) => (
                <li
                  key={badge}
                  className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--ink))]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-light/60 text-brand">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  {badge}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] shadow-soft lg:aspect-[5/6]">
          <Image
            src={heroImageFor(business)}
            alt={`${business.primaryService} in ${business.address.city} — ${business.name}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
        </div>
      </Container>
    </section>
  );
}
