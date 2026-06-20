import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { buildMetadata } from "@/lib/seo";
import { hasRating } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import ServicesGrid from "@/components/ServicesGrid";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Reveal from "@/components/Reveal";
import { CheckIcon } from "@/components/Icons";

export const revalidate = 3600;

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  return buildMetadata(business, "services");
}

export default async function ServicesPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  return (
    <>
      <PageHeader
        business={business}
        page="services"
        title={`${business.primaryService} services in ${business.address.city}`}
        subtitle={`From quick fixes to complete projects, here's how ${business.name} can help.${
          hasRating(business) ? ` Every job is backed by our ${business.rating!.value}/5 customer rating.` : " Every job is backed by our local reputation."
        }`}
      />

      <ServicesGrid business={business} />

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Covering all of {business.address.city}
            </h2>
            <p className="mt-4 text-gray-600">
              Wherever you are in {business.address.city}, our {business.primaryService.toLowerCase()} team
              is ready to help. We regularly work across:
            </p>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {business.serviceAreas.map((area) => (
                <li
                  key={area}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span className="font-medium text-gray-800">
                    {business.primaryService} in {area}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <Testimonials business={business} />
      <CTASection
        business={business}
        title={`Ready to book your ${business.primaryService.toLowerCase()}?`}
      />
    </>
  );
}
