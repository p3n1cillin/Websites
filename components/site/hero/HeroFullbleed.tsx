import Image from "next/image";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import { heroImageFor, hasRating } from "@/lib/utils";
import { BLUR_DATA_URL } from "@/lib/images";
import { CheckIcon } from "@/components/Icons";
import StarRating from "@/components/StarRating";
import { CallButton, ActionButton } from "../primitives";
import ExperimentText from "../ExperimentText";

/** Hero variant: full-bleed photo with a dark brand gradient and white copy. */
export default function HeroFullbleed({
  business,
  dna,
}: {
  business: Business;
  dna: DesignDNA;
}) {
  const lively = dna.motion === "lively";
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src={heroImageFor(business)}
          alt={`${business.primaryService} in ${business.address.city} — ${business.name}`}
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/90 via-brand-dark/75 to-gray-900/85" />
      </div>

      <div
        className={`mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 ${lively ? "animate-fade-up" : ""}`}
      >
        <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur">
          {hasRating(business) ? (
            <>
              <StarRating value={business.rating!.value} size="h-4 w-4" />
              <span>
                {business.rating!.value}/5 from {business.rating!.count}+ {business.address.city} customers
              </span>
            </>
          ) : (
            <span>Trusted local {business.primaryService.toLowerCase()} in {business.address.city}</span>
          )}
        </div>

        <h1
          style={{ fontFamily: "var(--font-heading)" }}
          className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          {business.categoryLabel} in <span className="text-brand-light">{business.address.city}</span>
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-100">
          <ExperimentText businessSlug={business.slug} slot="headline">
            {business.tagline}
          </ExperimentText>
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CallButton business={business} variant="light" />
          <ActionButton business={business} tone="light" />
        </div>

        <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
          {business.badges.map((badge) => (
            <li key={badge} className="flex items-center gap-2 text-sm font-medium text-gray-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <CheckIcon className="h-3.5 w-3.5 text-white" />
              </span>
              {badge}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
