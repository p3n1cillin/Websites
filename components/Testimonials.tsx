import type { Business } from "@/lib/types";
import { hasRating, hasReviews } from "@/lib/utils";
import Reveal from "./Reveal";
import StarRating from "./StarRating";

export default function Testimonials({ business }: { business: Business }) {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Reviews
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            What {business.address.city} says about us
          </h2>
          {hasRating(business) && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <StarRating value={business.rating!.value} size="h-5 w-5" />
              <span className="text-gray-700">
                <strong>{business.rating!.value}/5</strong> from {business.rating!.count}+ reviews
              </span>
            </div>
          )}
        </Reveal>

        {/* Never fabricate reviews: with none on file, show a clearly-labelled
            placeholder inviting real ones rather than inventing quotes. */}
        {!hasReviews(business) ? (
          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-base font-semibold text-gray-700">Your customer reviews appear here</p>
            <p className="mt-2 text-sm text-gray-500">
              Add 2–3 real reviews from happy {business.address.city} customers and they&apos;ll show
              in this section.
            </p>
          </div>
        ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {business.testimonials.map((t, i) => (
            <Reveal
              key={t.author}
              as="article"
              delay={i * 0.1}
              className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
            >
              <StarRating value={t.rating} size="h-5 w-5" />
              <blockquote className="mt-4 flex-1 text-gray-700">
                “{t.quote}”
              </blockquote>
              <footer className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light/60 text-sm font-bold text-brand">
                  {t.author.charAt(0)}
                </span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.author}</div>
                  {t.location && (
                    <div className="text-xs text-gray-500">{t.location}</div>
                  )}
                </div>
              </footer>
            </Reveal>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}
