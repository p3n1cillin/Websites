import Image from "next/image";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";
import { heroImageFor } from "@/lib/utils";
import { BLUR_DATA_URL } from "@/lib/images";
import { CheckIcon } from "@/components/Icons";
import StarRating from "@/components/StarRating";
import { hasRating } from "@/lib/utils";
import { Container, CallButton, ActionButton } from "../primitives";
import ExperimentText from "../ExperimentText";

/** Hero variant: light split layout — copy on the left, framed photo on the right. */
export default function HeroSpotlight({
  business,
  dna,
}: {
  business: Business;
  dna: DesignDNA;
}) {
  const lively = dna.motion === "lively";
  return (
    <section className="bg-[rgb(var(--surface))] py-[var(--section-y)]">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className={lively ? "animate-fade-up" : ""}>
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-brand-light/40 px-3.5 py-1.5 text-sm font-medium text-brand-dark">
            {hasRating(business) ? (
              <>
                <StarRating value={business.rating!.value} size="h-4 w-4" />
                <span>
                  {business.rating!.value}/5 · {business.rating!.count}+ reviews
                </span>
              </>
            ) : (
              <span>Local {business.primaryService.toLowerCase()} · {business.address.city}</span>
            )}
          </div>

          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-[rgb(var(--ink))] sm:text-5xl lg:text-6xl"
          >
            {business.categoryLabel} in <span className="text-brand">{business.address.city}</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[rgb(var(--ink-muted))]">
            <ExperimentText businessSlug={business.slug} slot="headline">
              {business.tagline}
            </ExperimentText>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CallButton business={business} />
            <ActionButton business={business} tone="outline" />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
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
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] shadow-soft lg:aspect-[5/4]">
          <Image
            src={heroImageFor(business)}
            alt={`${business.primaryService} in ${business.address.city} — ${business.name}`}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
        </div>
      </Container>
    </section>
  );
}
