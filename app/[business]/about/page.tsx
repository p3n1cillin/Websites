import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { buildMetadata } from "@/lib/seo";
import { heroImageFor, hasRating } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import OpeningHours from "@/components/OpeningHours";
import Reveal from "@/components/Reveal";
import StarRating from "@/components/StarRating";
import { CheckIcon } from "@/components/Icons";

export const revalidate = 3600;

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  return buildMetadata(business, "about");
}

export default async function AboutPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  const paragraphs = business.about.split("\n\n");

  return (
    <>
      <PageHeader
        business={business}
        page="about"
        title={`About ${business.name}`}
        subtitle={`Your trusted ${business.categoryLabel.toLowerCase()} in ${business.address.city}${
          business.established ? `, established ${business.established}` : ""
        }.`}
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal from="right">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-soft">
              <Image
                src={heroImageFor(business)}
                alt={`${business.name} — ${business.categoryLabel} in ${business.address.city}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {hasRating(business) && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-gray-50 p-5">
                <StarRating value={business.rating!.value} size="h-6 w-6" />
                <p className="text-gray-700">
                  <strong className="text-gray-900">{business.rating!.value}/5</strong> from{" "}
                  {business.rating!.count}+ {business.address.city} customers
                </p>
              </div>
            )}
          </Reveal>

          <Reveal from="left">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              {business.tagline}
            </h2>
            <div className="mt-4 space-y-4 text-gray-600">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <h3 className="mt-8 text-lg font-bold text-gray-900">
              Why customers trust us
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {business.badges.map((badge) => (
                <li key={badge} className="flex items-center gap-2.5 text-gray-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{badge}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <OpeningHours business={business} />
            </div>
          </Reveal>
        </div>
      </section>

      <Testimonials business={business} />
      <CTASection business={business} />
    </>
  );
}
