import { submitPreviewPassword } from "./gate-actions";

/**
 * Password gate for a privately-shared demo. Server component with a server-action
 * form — no client JS needed. Shown by the preview route when the demo has a
 * password set and the visitor hasn't cleared it yet.
 */
export default function PreviewGate({ token, bad }: { token: string; bad?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        action={submitPreviewPassword}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />
        <h1 className="text-lg font-semibold text-slate-900">This demo is private</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the password you were given to view it.
        </p>
        {bad && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            That password didn&apos;t match — try again.
          </p>
        )}
        <input
          name="password"
          type="password"
          autoFocus
          required
          placeholder="Password"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          View demo
        </button>
      </form>
    </div>
  );
}
