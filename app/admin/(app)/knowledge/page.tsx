import { requireOrg } from "@/lib/auth";
import {
  listKnowledge,
  type IndustryProfileKnowledge,
  type WinningPatternKnowledge,
} from "@/lib/knowledge";

export const dynamic = "force-dynamic";

/**
 * Read-only view of what the platform has learned (the AI Knowledge layer): the
 * industries it understands and the conversion copy that has won A/B tests. Both
 * accrue automatically as the Prospecting + Conversion agents run.
 */
export default async function KnowledgePage() {
  const org = await requireOrg();
  const all = await listKnowledge(org.id);
  const industries = all.filter((e) => e.kind === "industry_profile");
  const patterns = all.filter((e) => e.kind === "winning_pattern");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge</h1>
        <p className="mt-1 text-sm text-slate-500">
          What the platform has learned as the agents run — industries it understands and copy that
          has won A/B tests. This guides future generation (without copying it).
        </p>
      </div>

      {/* Industries learned */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">
          Industries understood {industries.length > 0 && `(${industries.length})`}
        </h2>
        {industries.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            None yet — generate a demo for a prospect and the industry is learned automatically.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {industries.map((e) => {
              const v = e.value as IndustryProfileKnowledge;
              return (
                <div key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium capitalize text-slate-800">{e.key}</p>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                      seen {e.hits + 1}×
                    </span>
                  </div>
                  {v?.personality && (
                    <p className="mt-1 text-xs text-slate-500">Feel: {v.personality.replace(/-/g, " ")}{v.needsMenu ? " · has menu" : ""}</p>
                  )}
                  {(v?.services?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Services: {v.services.slice(0, 5).join(", ")}
                    </p>
                  )}
                  {(v?.faqs?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-slate-400">{v.faqs.length} FAQ topics learned</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Winning copy */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-700">
          Winning copy {patterns.length > 0 && `(${patterns.length})`}
        </h2>
        {patterns.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">
            None yet — when an A/B test produces a clear winner, the copy is remembered here and
            reused to seed future tests for that industry.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {patterns.map((e) => {
              const v = e.value as WinningPatternKnowledge;
              const [ind, slot] = e.key.split("|");
              return (
                <div key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600">
                    <span className="capitalize">{ind}</span> · {slot}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {v?.texts?.map((t, i) => (
                      <li key={i} className="text-sm text-slate-700">
                        {i === 0 ? "★" : "•"} “{t}”
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
