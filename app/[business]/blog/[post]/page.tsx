import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/businesses";
import { getPublishedPost, getPublishedPosts, getAllPublishedPostRefs } from "@/lib/blog";
import { buildBlogMetadata, articleJsonLd } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Markdown from "@/components/Markdown";
import CTASection from "@/components/CTASection";
import { ArrowRightIcon } from "@/components/Icons";

interface Props {
  params: { business: string; post: string };
}

/** Pre-render every published article (SSG). New posts render on-demand. */
export async function generateStaticParams() {
  const refs = await getAllPublishedPostRefs();
  return refs.map((r) => ({ business: r.businessSlug, post: r.postSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await getBusinessBySlug(params.business);
  if (!business) return {};
  const post = await getPublishedPost(params.business, params.post);
  if (!post) return {};
  return buildBlogMetadata(business, post);
}

export default async function BlogPostPage({ params }: Props) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();
  const post = await getPublishedPost(params.business, params.post);
  if (!post) notFound();

  const base = `/${business.slug}`;
  const related = (await getPublishedPosts(business.slug))
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  const published = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <JsonLd data={articleJsonLd(business, post)} />

      <section className="relative overflow-hidden bg-brand-dark">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/30 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-sm text-white/70">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={base} className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`${base}/blog`} className="hover:text-white">
                  Guides
                </Link>
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {published && <p className="mt-4 text-sm text-white/70">Published {published}</p>}
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Markdown source={post.bodyMdx} />

        <div className="mt-12 rounded-2xl bg-gray-50 p-6 text-center">
          <p className="text-lg font-bold text-gray-900">
            Need a {business.categoryLabel.toLowerCase()} in {business.address.city}?
          </p>
          <p className="mt-1 text-gray-600">
            {business.name} is ready to help — fast response, upfront pricing.
          </p>
          <Link
            href={`${base}/contact`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.03]"
          >
            Get a free quote
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
              More {business.primaryService.toLowerCase()} guides
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`${base}/blog/${r.slug}`}
                  className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="font-bold text-gray-900 group-hover:text-brand">{r.title}</h3>
                  {r.metaDescription && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">{r.metaDescription}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTASection business={business} />
    </>
  );
}
