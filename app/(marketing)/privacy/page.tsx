import type { Metadata } from "next";
import { brand, hasBrandEmail } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-400">Last updated {new Date().getFullYear()}</p>

      <Section title="1. Overview">
        <p>
          {brand.legalName} (&quot;we&quot;) respects your privacy. This policy explains what personal
          data we collect, why, and your rights over it.
        </p>
      </Section>

      <Section title="2. Data we collect">
        <p>
          <strong>Enquiries.</strong> When you contact us we collect the details you provide — such as
          your name, business, email and phone number — to respond and provide a quote.
        </p>
        <p>
          <strong>Payments.</strong> Payments are processed by Stripe. We receive confirmation of
          payment and limited transaction details, but we never receive or store your full card number.
        </p>
        <p>
          <strong>Usage.</strong> We may collect basic, aggregated analytics about how this site is
          used to improve it.
        </p>
      </Section>

      <Section title="3. How we use it">
        <p>
          We use your data to respond to enquiries, deliver and support our services, process payments,
          and meet legal and accounting obligations. We do not sell your personal data.
        </p>
      </Section>

      <Section title="4. Sharing">
        <p>
          We share data only with service providers who help us operate — for example Stripe (payments)
          and our hosting and email providers — and only as needed to deliver the service, or where
          required by law.
        </p>
      </Section>

      <Section title="5. Retention">
        <p>
          We keep personal data only as long as necessary for the purposes above and to meet legal
          obligations, then delete or anonymise it.
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You may request access to, correction of, or deletion of your personal data, and object to
          certain processing. To exercise these rights, contact us
          {hasBrandEmail ? <> at <a href={`mailto:${brand.email}`} className="text-slate-900 underline">{brand.email}</a></> : <> using the details on our contact page</>}.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          {brand.legalName}, {brand.location}.
          {hasBrandEmail ? <> Email: <a href={`mailto:${brand.email}`} className="text-slate-900 underline">{brand.email}</a>.</> : null}
        </p>
      </Section>

      <p className="mt-10 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        This is a general template provided for transparency. Review it against the privacy laws that
        apply to your business (e.g. UK GDPR) before relying on it.
      </p>
    </div>
  );
}
