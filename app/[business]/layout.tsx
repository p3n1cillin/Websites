import { notFound } from "next/navigation";
import { getAllSlugs, getBusinessBySlug } from "@/lib/businesses";
import { getPublishedPosts } from "@/lib/blog";
import { getPalette } from "@/lib/branding";
import { getDesignDNA } from "@/lib/design/dna";
import { localBusinessJsonLd } from "@/lib/seo";
import ThemeProvider from "@/components/site/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyCallBar from "@/components/StickyCallBar";
import JsonLd from "@/components/JsonLd";

interface LayoutProps {
  children: React.ReactNode;
  params: { business: string };
}

/** Pre-render every business at build time (SSG) for instant, SEO-ready pages. */
export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((business) => ({ business }));
}

export default async function BusinessLayout({ children, params }: LayoutProps) {
  const business = await getBusinessBySlug(params.business);
  if (!business) notFound();

  const palette = getPalette(business);
  // The presentation genome — emitted as CSS variables by ThemeProvider so the whole
  // site (every page below) re-skins from data. See lib/design.
  const dna = getDesignDNA(business);
  // Only surface the blog nav once the SEO engine has published articles.
  const showBlog = (await getPublishedPosts(params.business)).length > 0;

  return (
    <ThemeProvider business={business} dna={dna} className="flex min-h-screen flex-col">
      {/* LocalBusiness structured data — rendered once per site in the layout. */}
      <JsonLd data={localBusinessJsonLd(business)} />
      {/* Brand colour for browser UI / PWA theming. */}
      <meta name="theme-color" content={palette.primaryHex} />

      <Navbar business={business} showBlog={showBlog} />
      <div className="flex-1">{children}</div>
      <Footer business={business} showBlog={showBlog} />
      <StickyCallBar business={business} />
    </ThemeProvider>
  );
}
