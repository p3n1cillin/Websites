"use client";

import Link from "next/link";

/**
 * The Nexus — the agency rendered as a living sci-fi operations station. Every
 * element maps to a REAL entity/metric (props below come straight from the data
 * layers in page.tsx) — motion is decorative, the numbers never are. Pure SVG + CSS
 * (zero deps), 2D, responsive; the architecture leaves room for a future 3D mode.
 */

export interface NexusAgent {
  kind: string;
  label: string;
  state: "active" | "idle" | "failed";
  runs24h: number;
}

export interface NexusCluster {
  label: string;
  size: number;
  dominationScore: number;
}

export interface NexusData {
  /** 0–100 composite agency health. */
  health: number;
  mrrPence: number;
  targetPence: number;
  pipelinePence: number;
  proposalValuePence: number;
  wonValuePence: number;
  ltvPence: number;
  throughput24h: number;
  discoveryVelocity7d: number;
  successRate: number | null;
  discovery: { total: number; last7d: number; clusters: NexusCluster[] };
  intelligence: { analysed: number; audited: number };
  factory: { building: number; demos: number; live: number };
  sales: { outreachSent: number; proposalsSent: number; responded: number; won: number };
  deployment: { published: number; customDomains: number };
  success: { clients: number; thriving: number; attention: number };
}

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

function healthTone(h: number): { ring: string; glow: string; text: string; label: string } {
  if (h >= 70) return { ring: "#10b981", glow: "rgba(16,185,129,0.55)", text: "text-emerald-300", label: "OPTIMAL" };
  if (h >= 40) return { ring: "#f59e0b", glow: "rgba(245,158,11,0.5)", text: "text-amber-300", label: "STABLE" };
  return { ring: "#ef4444", glow: "rgba(239,68,68,0.5)", text: "text-red-300", label: "CRITICAL" };
}

const STATE_DOT: Record<NexusAgent["state"], string> = {
  active: "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)] animate-[nexpulse_1.4s_ease-in-out_infinite]",
  idle: "bg-slate-600",
  failed: "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]",
};

function Station({
  href,
  name,
  code,
  online,
  children,
}: {
  href: string;
  name: string;
  code: string;
  online: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-900/60 p-3 backdrop-blur transition-all hover:border-cyan-400/60 hover:bg-slate-900/80"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70">{code}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            online ? "bg-cyan-400 shadow-[0_0_6px_2px_rgba(34,211,238,0.7)]" : "bg-slate-700"
          }`}
        />
      </div>
      <h3 className="mt-0.5 text-sm font-semibold text-slate-100">{name}</h3>
      <div className="mt-2 space-y-1 text-xs text-slate-400">{children}</div>
      <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors group-hover:text-cyan-300">
        enter ▸
      </span>
    </Link>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-semibold ${accent ?? "text-slate-200"}`}>{value}</span>
    </div>
  );
}

export default function Nexus({ data, agents, orgName }: { data: NexusData; agents: NexusAgent[]; orgName: string }) {
  const tone = healthTone(data.health);
  const goalPct = data.targetPence > 0 ? Math.min(100, Math.round((data.mrrPence / data.targetPence) * 100)) : 0;
  // Ring animation speed reflects real 24h throughput (calmer when the agency is quiet).
  const spin = Math.max(6, 30 - Math.min(24, data.throughput24h)); // seconds/rev
  const activeAgents = agents.filter((a) => a.state === "active").length;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-cyan-500/20 p-5 sm:p-7"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(800px 500px at 90% 110%, rgba(168,85,247,0.10), transparent 60%), #060912",
      }}
    >
      <style>{`
        @keyframes nexpulse { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.45; transform:scale(.82);} }
        @keyframes nexspin { to { transform: rotate(360deg);} }
        @keyframes nexflow { 0% { background-position: 0 0;} 100% { background-position: 40px 0;} }
      `}</style>
      {/* starfield + grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,.5), transparent), radial-gradient(1px 1px at 120px 80px, rgba(255,255,255,.35), transparent), radial-gradient(1px 1px at 200px 160px, rgba(255,255,255,.4), transparent), radial-gradient(1px 1px at 320px 60px, rgba(255,255,255,.3), transparent)",
          backgroundSize: "360px 220px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400/80">Operations Nexus</h1>
            <p className="mt-1 text-lg font-semibold text-slate-100">{orgName}</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
            <span className={`h-2 w-2 rounded-full ${activeAgents ? "bg-emerald-400 animate-[nexpulse_1.4s_ease-in-out_infinite]" : "bg-slate-600"}`} />
            <span className="text-slate-400">{activeAgents} agent{activeAgents === 1 ? "" : "s"} active · {data.throughput24h} ops/24h</span>
          </div>
        </div>

        {/* Core + flanking vitals */}
        <div className="mt-5 grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
          {/* left vitals */}
          <div className="order-2 grid gap-2 lg:order-1">
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/50 p-3 text-xs">
              <p className="font-mono uppercase tracking-widest text-cyan-400/70">Revenue reactor</p>
              <Metric label="MRR (live)" value={`${gbp(data.mrrPence)}/mo`} accent="text-emerald-300" />
              <Metric label="Pipeline" value={gbp(data.pipelinePence)} accent="text-indigo-300" />
              <Metric label="Proposals out" value={gbp(data.proposalValuePence)} accent="text-amber-300" />
              <Metric label="Closed (signed)" value={gbp(data.wonValuePence)} />
              <Metric label="Client LTV" value={gbp(data.ltvPence)} accent="text-fuchsia-300" />
            </div>
          </div>

          {/* the Core */}
          <div className="order-1 mx-auto lg:order-2">
            <div className="relative h-56 w-56">
              <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
                <defs>
                  <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={tone.ring} stopOpacity="0.55" />
                    <stop offset="70%" stopColor={tone.ring} stopOpacity="0.05" />
                    <stop offset="100%" stopColor={tone.ring} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="92" fill="url(#coreGlow)" />
                {/* rotating outer ring */}
                <g style={{ transformOrigin: "100px 100px", animation: `nexspin ${spin}s linear infinite` }}>
                  <circle cx="100" cy="100" r="82" fill="none" stroke={tone.ring} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 8" />
                </g>
                <g style={{ transformOrigin: "100px 100px", animation: `nexspin ${spin * 1.8}s linear infinite reverse` }}>
                  <circle cx="100" cy="100" r="70" fill="none" stroke={tone.ring} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 6" />
                </g>
                {/* health arc */}
                <circle cx="100" cy="100" r="58" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                  cx="100"
                  cy="100"
                  r="58"
                  fill="none"
                  stroke={tone.ring}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.health / 100) * 2 * Math.PI * 58} ${2 * Math.PI * 58}`}
                  transform="rotate(-90 100 100)"
                  style={{ filter: `drop-shadow(0 0 6px ${tone.glow})` }}
                />
                <circle cx="100" cy="100" r="44" fill={tone.ring} fillOpacity="0.08" stroke={tone.ring} strokeOpacity="0.4" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Core integrity</span>
                <span className={`text-4xl font-bold ${tone.text}`}>{data.health}</span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.25em] ${tone.text}`}>{tone.label}</span>
                <span className="mt-1 text-xs text-slate-400">{gbp(data.mrrPence)}/mo · {goalPct}% to goal</span>
              </div>
            </div>
          </div>

          {/* right vitals */}
          <div className="order-3 grid gap-2">
            <div className="rounded-xl border border-cyan-500/20 bg-slate-900/50 p-3 text-xs">
              <p className="font-mono uppercase tracking-widest text-cyan-400/70">Throughput</p>
              <Metric label="Discovery velocity" value={`${data.discoveryVelocity7d}/7d`} accent="text-cyan-300" />
              <Metric label="Ops (24h)" value={data.throughput24h} accent="text-cyan-300" />
              <Metric label="Agent success" value={data.successRate === null ? "—" : `${data.successRate}%`} accent="text-emerald-300" />
              <Metric label="Live sites" value={data.factory.live} accent="text-emerald-300" />
              <Metric label="Needs attention" value={data.success.attention} accent={data.success.attention ? "text-red-300" : "text-slate-300"} />
            </div>
          </div>
        </div>

        {/* MRR energy conduit */}
        <div className="mt-5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-slate-500">
            <span>Recurring power · {gbp(data.mrrPence)}/mo</span>
            <span>target {gbp(data.targetPence)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-cyan-500/20 bg-slate-900/70">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, goalPct)}%`,
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(16,185,129,.95) 0 10px, rgba(16,185,129,.55) 10px 20px)",
                animation: "nexflow 1.2s linear infinite",
              }}
            />
          </div>
        </div>

        {/* Sectors */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Station href="/admin/prospects" name="Discovery Sector" code="SEC-01" online={data.discovery.last7d > 0}>
            <Metric label="Signals mapped" value={data.discovery.total} accent="text-cyan-300" />
            <Metric label="New (7d)" value={data.discovery.last7d} />
            {data.discovery.clusters[0] && (
              <p className="truncate text-[11px] text-slate-500">
                Densest: <span className="text-slate-300">{data.discovery.clusters[0].label}</span> ×{data.discovery.clusters[0].size}
              </p>
            )}
          </Station>

          <Station href="/admin/prospects" name="Intelligence Sector" code="SEC-02" online={data.intelligence.analysed > 0}>
            <Metric label="Profiled" value={data.intelligence.analysed} accent="text-violet-300" />
            <Metric label="Sites audited" value={data.intelligence.audited} />
          </Station>

          <Station href="/admin/factory" name="Website Factory" code="SEC-03" online={data.factory.building > 0 || data.factory.demos > 0}>
            <Metric label="Demos built" value={data.factory.demos} accent="text-amber-300" />
            <Metric label="In production" value={data.factory.building} />
            <Metric label="Live" value={data.factory.live} accent="text-emerald-300" />
          </Station>

          <Station href="/admin/prospects" name="Sales Sector" code="SEC-04" online={data.sales.outreachSent > 0}>
            <Metric label="Outreach sent" value={data.sales.outreachSent} accent="text-sky-300" />
            <Metric label="Proposals" value={data.sales.proposalsSent} />
            <Metric label="Replied" value={data.sales.responded} accent={data.sales.responded ? "text-emerald-300" : undefined} />
            <Metric label="Won" value={data.sales.won} accent="text-emerald-300" />
          </Station>

          <Station href="/admin/customers" name="Deployment Bay" code="SEC-05" online={data.deployment.published > 0}>
            <Metric label="Published" value={data.deployment.published} accent="text-emerald-300" />
            <Metric label="Custom domains" value={data.deployment.customDomains} />
          </Station>

          <Station href="/admin/customers" name="Client Success" code="SEC-06" online={data.success.clients > 0}>
            <Metric label="Active clients" value={data.success.clients} accent="text-fuchsia-300" />
            <Metric label="Thriving" value={data.success.thriving} accent="text-emerald-300" />
            <Metric label="Need attention" value={data.success.attention} accent={data.success.attention ? "text-red-300" : undefined} />
          </Station>
        </div>

        {/* Agent bay */}
        <div className="mt-5 rounded-xl border border-cyan-500/20 bg-slate-900/50 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/70">Agent bay</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {agents.map((a) => (
              <Link
                key={a.kind}
                href="/admin/agents"
                title={`${a.label} — ${a.state}${a.runs24h ? ` · ${a.runs24h} ops/24h` : ""}`}
                className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-400/50"
              >
                <span className={`h-2 w-2 rounded-full ${STATE_DOT[a.state]}`} />
                <span className="font-medium">{a.label}</span>
                {a.runs24h > 0 && <span className="font-mono text-[10px] text-slate-500">{a.runs24h}</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
