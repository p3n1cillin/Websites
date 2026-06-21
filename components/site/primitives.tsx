import Link from "next/link";
import type { ReactNode } from "react";
import type { Business } from "@/lib/types";
import { resolveCtas } from "@/lib/site-copy";
import { PhoneIcon, ArrowRightIcon } from "@/components/Icons";

/**
 * Token-driven primitives shared by the Design DNA variant library.
 *
 * Everything here reads CSS variables emitted by ThemeProvider (surface/ink/radius/
 * section-y/fonts) so a single component re-skins per business. Keep these thin —
 * the variety lives in how the variant components compose them.
 */

type SectionTone = "surface" | "muted" | "brand";

const TONE_CLASS: Record<SectionTone, string> = {
  surface: "bg-[rgb(var(--surface))] text-[rgb(var(--ink))]",
  muted: "bg-[rgb(var(--surface-muted))] text-[rgb(var(--ink))]",
  brand: "bg-brand text-brand-fg",
};

/** Full-width section with density-driven vertical padding. */
export function Section({
  tone = "surface",
  className = "",
  children,
}: {
  tone?: SectionTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${TONE_CLASS[tone]} py-[var(--section-y)] ${className}`}>
      {children}
    </section>
  );
}

/** Centred max-width content rail. */
export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** A small eyebrow/kicker label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wide text-brand">{children}</p>
  );
}

/** Section heading in the DNA heading font. */
export function Heading({
  children,
  className = "",
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      style={{ fontFamily: "var(--font-heading)" }}
      className={`font-bold tracking-tight text-[rgb(var(--ink))] ${className}`}
    >
      {children}
    </Tag>
  );
}

/** The primary "call us" button (uses the DNA pill radius). */
export function CallButton({
  business,
  variant = "solid",
  className = "",
}: {
  business: Business;
  variant?: "solid" | "light";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-6 py-3.5 text-base font-semibold shadow-sm transition-transform hover:scale-[1.03]";
  const skin =
    variant === "light"
      ? "bg-white text-gray-900"
      : "bg-brand text-brand-fg";

  // Primary CTA: call when there's a verified phone, otherwise the booking/enquiry
  // action. Never a fake number. The secondary (ActionButton) is guaranteed to differ.
  const { primary } = resolveCtas(business);
  if (primary.isTel) {
    return (
      <a href={primary.href} className={`${base} ${skin} ${className}`}>
        <PhoneIcon className={`h-5 w-5 ${variant === "light" ? "text-brand" : ""}`} />
        {primary.label}
      </a>
    );
  }
  return (
    <Link href={primary.href} className={`${base} ${skin} ${className}`}>
      {primary.label}
      <ArrowRightIcon className={`h-5 w-5 ${variant === "light" ? "text-brand" : ""}`} />
    </Link>
  );
}

/** The secondary conversion button (book or enquire). */
export function ActionButton({
  business,
  tone = "brand",
  className = "",
}: {
  business: Business;
  /** "brand" = filled brand, "outline" = bordered, "light" = filled white. */
  tone?: "brand" | "outline" | "light";
  className?: string;
}) {
  // Secondary CTA — always a different path from the primary (CallButton), so the
  // two buttons are never identical even when there's no phone.
  const { secondary } = resolveCtas(business);
  const href = secondary.href;
  const label = secondary.label;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] px-6 py-3.5 text-base font-semibold transition-colors";
  const skin =
    tone === "outline"
      ? "border-2 border-[rgb(var(--border))] text-[rgb(var(--ink))] hover:bg-[rgb(var(--surface-muted))]"
      : tone === "light"
        ? "border-2 border-white/70 text-white hover:bg-white/10"
        : "bg-brand text-brand-fg shadow-sm hover:scale-[1.03]";
  return (
    <Link href={href} className={`${base} ${skin} ${className}`}>
      {label}
      <ArrowRightIcon className="h-5 w-5" />
    </Link>
  );
}
