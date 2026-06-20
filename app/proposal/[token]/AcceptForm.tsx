"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptProposalAction } from "./actions";

/** Customer-facing accept button for a public proposal. */
export default function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  return (
    <div className="space-y-2">
      <button
        onClick={accept}
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Confirming…" : "Accept this proposal"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        No obligation to pay yet — accepting simply tells us to get started.
      </p>
    </div>
  );
}
