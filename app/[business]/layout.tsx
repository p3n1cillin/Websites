import { notFound } from "next/navigation";
import { Space_Grotesk, EB_Garamond, Roboto_Slab } from "next/font/google";
import { getAllSlugs, getBusinessBySlug } from "@/lib/businesses";

// Real, self-hosted display faces wired through the DNA font keys (lib/design/tokens
// FONT_STACKS). Heading-only, so body stays fast on Inter/system. Lifts every
// generated site's typography off web-safe system stacks.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-grotesk", display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-garamond", display: "swap" });
const slab = Roboto_Slab({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-slab", display: "swap" });
const FONT_VARS = `${grotesk.variable} ${garamond.variable} ${slab.variable}`;
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
  params: Promise<{ business: string }>;
}

/** Pre-render every business at build time (SSG) for instant, SEO-ready pages. */
export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((business) => ({ business }));
}

export default async function BusinessLayout({ children, params }: LayoutProps) {
  const { business: slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const palette = getPalette(business);
  // The presentation genome — emitted as CSS variables by ThemeProvider so the whole
  // site (every page below) re-skins from data. See lib/design.
  const dna = getDesignDNA(business);
  // Only surface the blog nav once the SEO engine has published articles.
  const showBlog = (await getPublishedPosts(slug)).length > 0;

  return (
    <ThemeProvider business={business} dna={dna} className={`${FONT_VARS} flex min-h-screen flex-col`}>
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
