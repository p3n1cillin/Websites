"use client";

import { useState } from "react";
import type { Business } from "@/lib/types";
import { hasPhone } from "@/lib/utils";
import { CheckIcon, ArrowRightIcon } from "./Icons";

type Status = "idle" | "submitting" | "success" | "error";

interface ContactFormProps {
  business: Business;
  /** "booking" adds a preferred date/time; "enquiry" is a general quote form. */
  variant?: "enquiry" | "booking";
}

export default function ContactForm({
  business,
  variant = "enquiry",
}: ContactFormProps) {
  const isBooking = variant === "booking";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // Honeypot — bots fill hidden fields; humans don't.
    if (data.company) {
      setStatus("success");
      form.reset();
      return;
    }

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          businessSlug: business.slug,
          businessName: business.name,
          type: variant,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-gray-900">
          Thank you — message sent!
        </h3>
        <p className="mt-2 text-gray-600">
          {business.name} has received your {isBooking ? "booking request" : "enquiry"} and
          will be in touch shortly.
          {hasPhone(business) && (
            <>
              {" "}Need us sooner? Call{" "}
              <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`} className="font-semibold text-brand">
                {business.phone}
              </a>
              .
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-sm font-semibold text-brand hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-800";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Your name <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" required autoComplete="name" className={inputClass} placeholder="Jane Smith" />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" className={inputClass} placeholder="07123 456789" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-red-500">*</span>
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} placeholder="jane@example.com" />
        </div>

        <div className={isBooking ? "" : "sm:col-span-2"}>
          <label htmlFor="service" className={labelClass}>
            {isBooking ? "Service" : "How can we help?"}
          </label>
          <select id="service" name="service" className={inputClass} defaultValue="">
            <option value="" disabled>
              Select a service…
            </option>
            {business.services.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
            <option value="Other">Other / not sure</option>
          </select>
        </div>

        {isBooking && (
          <div>
            <label htmlFor="preferredDate" className={labelClass}>
              Preferred date
            </label>
            <input id="preferredDate" name="preferredDate" type="date" className={inputClass} />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="message" className={labelClass}>
            {isBooking ? "Anything else we should know?" : "Message"}
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            className={inputClass}
            placeholder={
              isBooking
                ? "Let us know your preferred time, or any details about your booking…"
                : `Tell us a bit about what you need from your ${business.primaryService.toLowerCase()}…`
            }
          />
        </div>
      </div>

      {/* Honeypot field — visually hidden, ignored by humans. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company (leave blank)</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "error" && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-brand-fg shadow-sm transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "submitting" ? (
          "Sending…"
        ) : (
          <>
            {isBooking ? "Request Booking" : "Send Enquiry"}
            <ArrowRightIcon className="h-5 w-5" />
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-gray-500">
        We&apos;ll only use your details to respond to your {isBooking ? "booking" : "enquiry"}.
      </p>
    </form>
  );
}
