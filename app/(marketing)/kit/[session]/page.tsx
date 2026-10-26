import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPaidKitOrder, loadKitSections } from "@/lib/kit/order";
import { TIERS, type SectionId } from "@/lib/kit/catalog";
import KitViewer from "./KitViewer";
import sampleKitData from "@/lib/kit/sample-kit.json";

interface PageProps {
  params: Promise<{ session: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { session } = await params;
  if (session === "sample") {
    return {
      title: "Sample Map Pack Kit — Hartley Plumbing & Heating",
      description: "Live interactive sample of our Google Business Profile content kit.",
      robots: { index: false, follow: false },
    };
  }
  const order = await getPaidKitOrder(session);
  if (!order) return { title: "Kit Not Found" };
  return {
    title: `Map Pack Kit — ${order.input.businessName}`,
    description: `Your complete Google Business Profile content kit for ${order.input.businessName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function KitPage({ params }: PageProps) {
  const { session } = await params;

  // Dedicated sample preview route
  if (session === "sample") {
    const sample = sampleKitData as any;
    return (
      <div className="bg-slate-50 min-h-screen pb-20">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          Showing real sample output generated for a local trade business.{" "}
          <a href="/map-pack-kit#order" className="underline font-bold hover:text-amber-950">
            Order your own customized kit for £19 / £29 →
          </a>
        </div>
        <KitViewer
          sessionId="sample"
          tier={sample.tier}
          input={sample.input}
          initialSections={sample.sections}
          requiredSections={TIERS[sample.tier as keyof typeof TIERS].sections}
        />
      </div>
    );
  }

  const order = await getPaidKitOrder(session);
  if (!order) {
    notFound();
  }

  const existingSections = await loadKitSections(order);
  const requiredSections = TIERS[order.tier].sections;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <KitViewer
        sessionId={order.sessionId}
        tier={order.tier}
        input={order.input}
        initialSections={existingSections}
        requiredSections={requiredSections}
      />
    </div>
  );
}
