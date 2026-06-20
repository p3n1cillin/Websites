import Link from "next/link";
import type { Business } from "@/lib/types";
import { telHref, hasPhone } from "@/lib/utils";
import Reveal from "./Reveal";
import { PhoneIcon, ArrowRightIcon } from "./Icons";

interface CTASectionProps {
  business: Business;
  title?: string;
  subtitle?: string;
}

/**
 * Repeated, high-contrast conversion band. Dropped between sections and at the
 * foot of every page so there is always a call-to-action in view.
 */
export default function CTASection({
  business,
  title,
  subtitle,
}: CTASectionProps) {
  const ctaHref = business.enableBooking
    ? `/${business.slug}/book`
    : `/${business.slug}/contact`;
  const ctaLabel = business.enableBooking ? "Book Online" : "Request a Free Quote";

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Reveal className="relative overflow-hidden rounded-3xl bg-brand px-6 py-12 text-center shadow-soft sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-2xl font-extrabold tracking-tight text-brand-fg sm:text-3xl">
            {title ?? `Need a ${business.primaryService.toLowerCase()} in ${business.address.city}?`}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-fg/90">
            {subtitle ??
              `Friendly local service and no-obligation quotes. Get in touch today and we'll get back to you fast.`}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {hasPhone(business) && (
              <a
                href={telHref(business.phone)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow transition-transform hover:scale-[1.03] sm:w-auto"
              >
                <PhoneIcon className="h-5 w-5 text-brand" />
                Call {business.phone}
              </a>
            )}
            <Link
              href={ctaHref}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-colors sm:w-auto ${
                hasPhone(business)
                  ? "border-2 border-brand-fg/70 text-brand-fg hover:bg-black/10"
                  : "bg-white text-gray-900 shadow hover:scale-[1.03]"
              }`}
            >
              {ctaLabel}
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
