"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Business } from "@/lib/types";
import { heroImageFor, telHref, hasPhone, hasRating } from "@/lib/utils";
import { BLUR_DATA_URL } from "@/lib/images";
import { PhoneIcon, CheckIcon, ArrowRightIcon } from "./Icons";
import StarRating from "./StarRating";

export default function Hero({ business }: { business: Business }) {
  const ctaHref = business.enableBooking
    ? `/${business.slug}/book`
    : `/${business.slug}/contact`;
  const ctaLabel = business.enableBooking
    ? "Book Online"
    : "Get a Free Quote";

  const fade = {
    hidden: { opacity: 0, y: 22 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background image + gradient for legible, on-brand contrast. */}
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

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <motion.div
          custom={0}
          variants={fade}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur"
        >
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
        </motion.div>

        <motion.h1
          custom={1}
          variants={fade}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          {business.categoryLabel} in{" "}
          <span className="text-brand-light">{business.address.city}</span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fade}
          initial="hidden"
          animate="show"
          className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-100"
        >
          {business.tagline}
        </motion.p>

        <motion.div
          custom={3}
          variants={fade}
          initial="hidden"
          animate="show"
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          {hasPhone(business) ? (
            <>
              <a
                href={telHref(business.phone)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow-lg transition-transform hover:scale-[1.03]"
              >
                <PhoneIcon className="h-5 w-5 text-brand" />
                Call {business.phone}
              </a>
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/70 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                {ctaLabel}
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
            </>
          ) : (
            // No verified phone yet → lead with the enquiry CTA (never a fake number).
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-semibold text-gray-900 shadow-lg transition-transform hover:scale-[1.03]"
            >
              {ctaLabel}
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          )}
        </motion.div>

        <motion.ul
          custom={4}
          variants={fade}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-wrap gap-x-6 gap-y-3"
        >
          {business.badges.map((badge) => (
            <li key={badge} className="flex items-center gap-2 text-sm font-medium text-gray-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <CheckIcon className="h-3.5 w-3.5 text-white" />
              </span>
              {badge}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
