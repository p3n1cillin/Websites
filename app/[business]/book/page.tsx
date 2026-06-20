import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { buildMetadata } from "@/lib/seo";
import { telHref, hasRating, hasPhone } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import OpeningHours from "@/components/OpeningHours";
import Reveal from "@/components/Reveal";
import StarRating from "@/components/StarRating";
import { PhoneIcon, CheckIcon } from "@/components/Icons";

export const revalidate = 3600;

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business || !business.enableBooking) return {};
  return buildMetadata(business, "book");
}

export default async function BookPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  // Businesses that don't offer booking simply don't expose this page.
  if (!business || !business.enableBooking) notFound();

  const steps = [
    "Tell us what you need and your preferred date",
    "We confirm availability and a time that suits you",
    "You're booked — we'll send a reminder before your appointment",
  ];

  return (
    <>
      <PageHeader
        business={business}
        page="book"
        title={`Book ${business.name} online`}
        subtitle={`Request your ${business.primaryService.toLowerCase()} booking in under a minute. Quick confirmation and no obligation.`}
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <Reveal from="right" className="lg:col-span-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              How booking works
            </h2>
            <ol className="mt-6 space-y-5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-fg">
                    {i + 1}
                  </span>
                  <p className="pt-1.5 text-gray-700">{step}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 rounded-2xl bg-gray-50 p-5">
              {hasRating(business) && (
                <div className="flex items-center gap-3">
                  <StarRating value={business.rating!.value} size="h-5 w-5" />
                  <p className="text-sm text-gray-700">
                    <strong>{business.rating!.value}/5</strong> · {business.rating!.count}+ happy customers
                  </p>
                </div>
              )}
              <ul className="mt-4 space-y-2">
                {business.badges.slice(0, 3).map((badge) => (
                  <li key={badge} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckIcon className="h-4 w-4 text-brand" />
                    {badge}
                  </li>
                ))}
              </ul>
            </div>

            {hasPhone(business) && (
              <a
                href={telHref(business.phone)}
                className="mt-6 flex items-center justify-center gap-2 rounded-full border-2 border-brand px-5 py-3 font-semibold text-brand transition hover:bg-brand-light/30"
              >
                <PhoneIcon className="h-5 w-5" />
                Prefer to call? {business.phone}
              </a>
            )}

            <div className="mt-6">
              <OpeningHours business={business} />
            </div>
          </Reveal>

          <Reveal from="left" className="lg:col-span-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Request your booking
            </h2>
            <p className="mt-3 text-gray-600">
              Fill in your details and we&apos;ll confirm your appointment shortly.
            </p>
            <div className="mt-6">
              <ContactForm business={business} variant="booking" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
