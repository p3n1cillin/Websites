import Image from "next/image";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import { heroImageFor, hasRating } from "@/lib/utils";
import { BLUR_DATA_URL } from "@/lib/images";
import StarRating from "@/components/StarRating";
import { CheckIcon } from "@/components/Icons";
import { Container, CallButton, ActionButton } from "../primitives";
import ExperimentText from "../ExperimentText";

/**
 * Hero variant: type-forward editorial. A large left-aligned statement headline and
 * CTAs sit above a wide supporting image band — distinct from the side-by-side
 * split (spotlight), the centered text+frame (minimal) and the full-bleed bg image
 * (fullbleed). Honest: rating/badges render only when real.
 */
export default function HeroEditorial({
  business,
  dna,
}: {
  business: Business;
  dna: DesignDNA;
}) {
  const lively = dna.motion === "lively";
  return (
    <section className="bg-[rgb(var(--surface))] py-[var(--section-y)]">
      <Container>
        <div className={`max-w-4xl ${lively ? "animate-fade-up" : ""}`}>
          <div className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--ink-muted))]">
            {hasRating(business) ? (
              <>
                <StarRating value={business.rating!.value} size="h-4 w-4" />
                <span>{business.rating!.value}/5 · {business.rating!.count}+ reviews</span>
              </>
            ) : (
              <span>Local {business.primaryService.toLowerCase()} in {business.address.city}</span>
            )}
          </div>

          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="mt-5 text-5xl font-bold leading-[1.02] tracking-tight text-[rgb(var(--ink))] sm:text-6xl lg:text-7xl"
          >
            {business.categoryLabel} in <span className="text-brand">{business.address.city}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[rgb(var(--ink-muted))] sm:text-xl">
            <ExperimentText businessSlug={business.slug} slot="headline">
              {business.tagline}
            </ExperimentText>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CallButton business={business} />
            <ActionButton business={business} tone="outline" />
          </div>
        </div>

        {/* Wide supporting image band — a real visual without the side-by-side split. */}
        <div
          className={`relative mt-12 aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)] shadow-soft sm:aspect-[21/9] ${
            lively ? "animate-fade-up" : ""
          }`}
        >
          <Image
            src={heroImageFor(business)}
            alt={`${business.primaryService} in ${business.address.city} — ${business.name}`}
            fill
            priority
            sizes="(min-width: 1024px) 80vw, 100vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
        </div>

        {business.badges.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5">
            {business.badges.map((badge) => (
              <li
                key={badge}
                className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--ink-muted))]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-fg">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {badge}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
