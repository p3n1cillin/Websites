import type { Metadata } from "next";
import { brand, hasBrandEmail } from "@/lib/brand";
import { gbp, PRICING } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms & Refund Policy",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service &amp; Refund Policy</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated {new Date().getFullYear()}</p>

      <Section title="1. Who we are">
        <p>
          {brand.legalName} (&quot;we&quot;, &quot;us&quot;) provides website design, build, hosting
          and ongoing maintenance services for businesses. These terms govern the services we provide
          and your use of this website.
        </p>
      </Section>

      <Section title="2. Services">
        <p>
          We design and build a website to an agreed scope, set out in a written proposal. Where a
          care plan is purchased, we provide hosting, maintenance, updates and support for as long as
          the plan is active.
        </p>
      </Section>

      <Section title="3. Pricing & payment">
        <p>
          Website builds are charged as a one-off fee from {gbp(PRICING.buildFromPence)}, confirmed in
          your proposal before any payment is taken. The care plan is {gbp(PRICING.carePlanPence)} per
          month. Payments are processed securely by Stripe; we do not store your card details.
        </p>
        <p>
          The build fee is payable on acceptance of the proposal. Care plan fees are billed monthly in
          advance.
        </p>
      </Section>

      <Section title="4. Refunds & cancellation">
        <p>
          <strong>Build fee.</strong> Because work begins on acceptance, the build fee is refundable
          only for work not yet started. If you cancel after work has begun but before launch, we will
          refund the portion of the fee corresponding to work not yet completed, at our reasonable
          discretion. Once a site is delivered and approved, the build fee is non-refundable.
        </p>
        <p>
          <strong>Care plan.</strong> The monthly care plan can be cancelled at any time and will stop
          at the end of the current billing period. Monthly fees already paid are non-refundable, and
          no further payments are taken after cancellation.
        </p>
        <p>
          To request a refund or cancel, contact us
          {hasBrandEmail ? <> at <a href={`mailto:${brand.email}`} className="text-slate-900 underline">{brand.email}</a></> : null}.
          We aim to respond within 3 business days.
        </p>
      </Section>

      <Section title="5. Your responsibilities">
        <p>
          You are responsible for providing accurate business information and the rights to any content
          you supply. We will not publish information we know to be inaccurate.
        </p>
      </Section>

      <Section title="6. Intellectual property">
        <p>
          On full payment of the build fee, ownership of the delivered website design and content
          transfers to you. Underlying platform, tooling and any third-party components remain the
          property of their respective owners.
        </p>
      </Section>

      <Section title="7. Liability">
        <p>
          We provide our services with reasonable care and skill. To the extent permitted by law, our
          total liability arising from the services is limited to the fees you have paid us in the
          preceding twelve months. Nothing in these terms excludes liability that cannot be excluded by
          law.
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          Questions about these terms can be sent to
          {hasBrandEmail ? <> <a href={`mailto:${brand.email}`} className="text-slate-900 underline">{brand.email}</a></> : <> our contact address</>}.
          Business: {brand.legalName}, {brand.location}.
        </p>
      </Section>

      <p className="mt-10 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        This is a general template provided for transparency. Review it (and have it checked against
        your local consumer law) before relying on it for your business.
      </p>
    </div>
  );
}
