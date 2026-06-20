import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { getPublishedPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";
import CTASection from "@/components/CTASection";
import Reveal from "@/components/Reveal";
import { ArrowRightIcon } from "@/components/Icons";

interface Props {
  params: { business: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  const title = `${business.primaryService} Advice & Guides in ${business.address.city} | ${business.name}`;
  const description = `Local ${business.primaryService.toLowerCase()} tips, guides and area advice from ${business.name}, your trusted ${business.categoryLabel.toLowerCase()} in ${business.address.city}.`;
  const url = `${SITE_URL}/${business.slug}/blog`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: business.name, locale: "en_GB" },
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  const posts = await getPublishedPosts(business.slug);
  const base = `/${business.slug}`;

  return (
    <>
      <section className="relative overflow-hidden bg-brand-dark">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/30 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-sm text-white/70">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={base} className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-white">Guides</li>
            </ol>
          </nav>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {business.primaryService} guides &amp; local advice
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            Helpful {business.primaryService.toLowerCase()} tips and area guides from {business.name}, covering{" "}
            {business.address.city} and the surrounding areas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <p className="text-gray-600">
              New guides are on the way. In the meantime, {" "}
              <Link href={`${base}/contact`} className="font-medium text-brand hover:underline">
                get in touch
              </Link>{" "}
              and we&apos;ll be happy to help.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Reveal key={post.id}>
                <Link
                  href={`${base}/blog/${post.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  {post.targetKeyword && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                      {business.primaryService}
                    </span>
                  )}
                  <h2 className="mt-2 text-lg font-bold text-gray-900 group-hover:text-brand">
                    {post.title}
                  </h2>
                  {post.metaDescription && (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-gray-600">
                      {post.metaDescription}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    Read guide
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <CTASection business={business} />
    </>
  );
}
