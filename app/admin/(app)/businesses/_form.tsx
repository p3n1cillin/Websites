"use client";

import { useFormState, useFormStatus } from "react-dom";
import { BUSINESS_CATEGORIES, type Business } from "@/lib/types";
import type { FormActionState } from "./actions";

type Action = (prev: FormActionState, formData: FormData) => Promise<FormActionState>;

const STARTER_SERVICES = JSON.stringify(
  [{ name: "Example Service", description: "What it is and the benefit.", price: "From £50", icon: "wrench" }],
  null,
  2
);
const STARTER_HOURS = JSON.stringify(
  [{ day: "Monday", hours: "09:00 – 17:00" }],
  null,
  2
);
const STARTER_TESTIMONIALS = JSON.stringify(
  [{ author: "Jane D.", rating: 5, location: "Warrington", quote: "Excellent service." }],
  null,
  2
);

const input =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";
const mono = `${input} font-mono`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function BusinessForm({
  action,
  business,
  id,
  submitLabel,
}: {
  action: Action;
  business?: Business;
  id?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, {});
  const b = business;

  return (
    <form action={formAction} className="space-y-8">
      {id && <input type="hidden" name="id" value={id} />}

      {/* Identity */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input name="name" defaultValue={b?.name} required className={input} />
        </Field>
        <Field label="Slug (URL)">
          <input
            name="slug"
            defaultValue={b?.slug}
            placeholder="auto from name"
            className={input}
          />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={b?.category ?? ""} required className={input}>
            <option value="" disabled>
              Select…
            </option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category label">
          <input
            name="categoryLabel"
            defaultValue={b?.categoryLabel}
            placeholder="e.g. Emergency Plumber"
            className={input}
          />
        </Field>
        <Field label="Primary service (SEO keyword)">
          <input
            name="primaryService"
            defaultValue={b?.primaryService}
            placeholder="e.g. Plumber"
            className={input}
          />
        </Field>
        <Field label="Established (year)">
          <input
            name="established"
            type="number"
            defaultValue={b?.established}
            className={input}
          />
        </Field>
      </section>

      <Field label="Tagline">
        <input name="tagline" defaultValue={b?.tagline} className={input} />
      </Field>
      <Field label="About">
        <textarea name="about" defaultValue={b?.about} rows={5} className={input} />
      </Field>

      {/* Contact + address */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input name="phone" defaultValue={b?.phone} required className={input} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={b?.email} required className={input} />
        </Field>
        <Field label="Address line 1">
          <input name="addressLine1" defaultValue={b?.address.line1} className={input} />
        </Field>
        <Field label="Address line 2">
          <input name="addressLine2" defaultValue={b?.address.line2 ?? ""} className={input} />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={b?.address.city ?? "Warrington"} className={input} />
        </Field>
        <Field label="Postcode">
          <input name="postcode" defaultValue={b?.address.postcode} className={input} />
        </Field>
      </section>

      {/* Lists */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Service areas (one per line)">
          <textarea
            name="serviceAreas"
            defaultValue={b?.serviceAreas.join("\n")}
            rows={5}
            className={input}
          />
        </Field>
        <Field label="Trust badges (one per line)">
          <textarea
            name="badges"
            defaultValue={b?.badges.join("\n")}
            rows={5}
            className={input}
          />
        </Field>
      </section>

      {/* Structured JSON */}
      <section className="space-y-4">
        <Field label="Services (JSON array)">
          <textarea
            name="services"
            defaultValue={b ? JSON.stringify(b.services, null, 2) : STARTER_SERVICES}
            rows={8}
            className={mono}
          />
        </Field>
        <Field label="Opening hours (JSON array)">
          <textarea
            name="openingHours"
            defaultValue={b ? JSON.stringify(b.openingHours, null, 2) : STARTER_HOURS}
            rows={6}
            className={mono}
          />
        </Field>
        <Field label="Testimonials (JSON array)">
          <textarea
            name="testimonials"
            defaultValue={b ? JSON.stringify(b.testimonials, null, 2) : STARTER_TESTIMONIALS}
            rows={6}
            className={mono}
          />
        </Field>
      </section>

      {/* Rating + brand + media */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Rating value (0–5)">
          <input
            name="ratingValue"
            type="number"
            step="0.1"
            defaultValue={b?.rating?.value ?? 5}
            className={input}
          />
        </Field>
        <Field label="Rating count">
          <input
            name="ratingCount"
            type="number"
            defaultValue={b?.rating?.count ?? 0}
            className={input}
          />
        </Field>
        <Field label="Brand primary (hex)">
          <input name="brandPrimary" defaultValue={b?.brand?.primary ?? ""} className={input} />
        </Field>
        <Field label="Brand accent (hex)">
          <input name="brandAccent" defaultValue={b?.brand?.accent ?? ""} className={input} />
        </Field>
        <Field label="Logo URL">
          <input name="brandLogoUrl" defaultValue={b?.brand?.logoUrl ?? ""} className={input} />
        </Field>
        <Field label="Hero image URL">
          <input name="heroImage" defaultValue={b?.heroImage ?? ""} className={input} />
        </Field>
      </section>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          name="enableBooking"
          type="checkbox"
          defaultChecked={b?.enableBooking ?? false}
          className="h-4 w-4"
        />
        Enable the online booking page
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <SaveButton label={submitLabel} />
    </form>
  );
}
