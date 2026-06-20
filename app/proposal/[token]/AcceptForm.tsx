"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptProposalAction, payProposalAction } from "./actions";

/**
 * Customer-facing actions for a public proposal. When card payment is enabled the
 * primary action is "Pay & get started" (real Stripe Checkout → money in the bank);
 * "Accept without paying" stays as a no-pressure secondary. Without Stripe, only the
 * accept button shows.
 */
export default function AcceptForm({
  token,
  canPay,
  price,
}: {
  token: string;
  canPay: boolean;
  price: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptProposalAction(token);
      if (!res.ok) {
        setError(res.error || "Something went wrong — please try again.");
        return;
      }
      router.refresh();
    });
  }

  async function pay() {
    setError(null);
    setPaying(true);
    try {
      const res = await payProposalAction(token);
      if (res.ok && res.url) {
        window.location.href = res.url; // off to Stripe Checkout
        return;
      }
      setError(res.error || "Couldn't start checkout — please try again.");
    } catch {
      setError("Couldn't start checkout — please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-3">
      {canPay ? (
        <>
          <button
            onClick={pay}
            disabled={paying || pending}
            className="w-full rounded-lg bg-emerald-600 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {paying ? "Redirecting to secure checkout…" : `Pay ${price} & get started`}
          </button>
          <button
            onClick={accept}
            disabled={pending || paying}
            className="text-sm font-medium text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
          >
            {pending ? "Confirming…" : "Or accept now and pay later"}
          </button>
          <p className="text-xs text-slate-400">Secure card payment via Stripe. Cancel anytime.</p>
        </>
      ) : (
        <>
          <button
            onClick={accept}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "Confirming…" : "Accept this proposal"}
          </button>
          <p className="text-xs text-slate-400">
            No obligation to pay yet — accepting simply tells us to get started.
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
