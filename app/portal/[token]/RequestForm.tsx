"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitChangeRequestAction } from "./actions";

/** Customer-facing change-request form (public portal). */
export default function RequestForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await submitChangeRequestAction(data);
      if (!res.ok) {
        setError(res.error || "Something went wrong.");
        return;
      }
      form.reset();
      setDone(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="title"
        required
        placeholder="What would you like changed? (e.g. Update opening hours)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        onChange={() => setDone(false)}
      />
      <textarea
        name="detail"
        rows={3}
        placeholder="Any details that would help us get it right…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-600">Thanks — we've got your request and will be in touch.</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
