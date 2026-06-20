import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { buildMetadata } from "@/lib/seo";
import { telHref, fullAddress, hasPhone, hasEmail, hasAddress } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import MapEmbed from "@/components/MapEmbed";
import OpeningHours from "@/components/OpeningHours";
import Reveal from "@/components/Reveal";
import { PhoneIcon, MailIcon, MapPinIcon } from "@/components/Icons";

export const revalidate = 3600;

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  return buildMetadata(business, "contact");
}

export default async function ContactPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  return (
    <>
      <PageHeader
        business={business}
        page="contact"
        title={`Contact ${business.name}`}
        subtitle={`Get a fast, no-obligation response. Call us, email us, or send the form below and we'll be in touch.`}
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Contact details + hours */}
          <Reveal from="right" className="lg:col-span-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Get in touch
            </h2>
            <p className="mt-3 text-gray-600">
              We&apos;re here to help across {business.address.city} and the
              surrounding areas.
            </p>

            <div className="mt-6 space-y-4">
              {/* Each contact card shows only when the fact is verified — the form
                  below is always available, so there's never a dead end. */}
              {hasPhone(business) && (
                <a
                  href={telHref(business.phone)}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-brand/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-fg">
                    <PhoneIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Call us
                    </span>
                    <span className="block font-semibold text-gray-900">{business.phone}</span>
                  </span>
                </a>
              )}

              {hasEmail(business) && (
                <a
                  href={`mailto:${business.email}`}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-brand/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-fg">
                    <MailIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Email us
                    </span>
                    <span className="block font-semibold text-gray-900">{business.email}</span>
                  </span>
                </a>
              )}

              {(hasAddress(business) || business.address.city) && (
                <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-fg">
                    <MapPinIcon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                      Find us
                    </span>
                    <span className="block font-semibold text-gray-900">
                      {hasAddress(business)
                        ? fullAddress(business)
                        : `${business.address.city} & surrounding areas`}
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <OpeningHours business={business} />
            </div>
          </Reveal>

          {/* Form */}
          <Reveal from="left" className="lg:col-span-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Send us a message
            </h2>
            <p className="mt-3 text-gray-600">
              Fill in the form and we&apos;ll get back to you as soon as we can.
            </p>
            <div className="mt-6">
              <ContactForm business={business} variant="enquiry" />
            </div>
          </Reveal>
        </div>

        <div className="mt-12">
          <MapEmbed business={business} />
        </div>
      </section>
    </>
  );
}
