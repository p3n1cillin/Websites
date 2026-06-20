import type { SiteComparison } from "@/lib/comparison";

/**
 * The "show, don't tell" before/after panel shown atop a prospect's demo. Pure
 * presentational server component — renders the two scores and the checklist of
 * wins so a business owner instantly sees what the new site fixes.
 */
export default function ComparisonBanner({
  businessName,
  comparison,
}: {
  businessName: string;
  comparison: SiteComparison;
}) {
  const { beforeScore, afterScore, currentReachable, items, wins } = comparison;
  const beforeLabel = !currentReachable ? "Offline / none" : `${beforeScore}/100`;

  return (
    <section className="border-b border-slate-200 bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          A free demo for {businessName}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          {wins > 0 ? `${wins} things this new site does that yours doesn't` : "See the difference"}
        </h2>

        {/* Score comparison */}
        <div className="mt-6 flex items-center justify-center gap-4 sm:gap-8">
          <ScoreCard title="Your site now" value={beforeLabel} tone="bad" />
          <span className="text-2xl text-slate-300">→</span>
          <ScoreCard title="Your new site" value={`${afterScore}/100`} tone="good" />
        </div>

        {/* Wins checklist */}
        <ul className="mx-auto mt-8 grid max-w-xl gap-2 text-left sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.before ? "bg-slate-100 text-slate-400" : "bg-emerald-100 text-emerald-700"
                }`}
                title={item.before ? "Your current site already has this" : "Added in the new site"}
              >
                {item.before ? "=" : "+"}
              </span>
              <span className={item.before ? "text-slate-500" : "font-medium text-slate-800"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-slate-500">
          Scroll down to explore your new site — built and ready to go live.
        </p>
      </div>
    </section>
  );
}

function ScoreCard({ title, value, tone }: { title: string; value: string; tone: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p
        className={`mt-1 text-3xl font-bold ${tone === "good" ? "text-emerald-600" : "text-slate-400"}`}
      >
        {value}
      </p>
    </div>
  );
}
