"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

/**
 * Discovery Starmap — the real business graph as a zoomable spatial map. Each node
 * is a real prospect (id/name/opportunity/status); faint spokes tie each to its
 * industry×town cluster centroid. Deterministic layout, pure SVG + pointer events
 * (zero deps): wheel to zoom, drag to pan, click a node to inspect. Virtualised by
 * rendering only the top-N opportunities so it stays fast as discovery scales.
 */

export interface StarNode {
  id: string;
  name: string;
  category: string;
  city: string;
  opportunity: number;
  status: string;
}

const MAX_NODES = 160;
const VIEW = 1000; // SVG viewBox size

function statusColor(status: string): string {
  switch (status) {
    case "won": return "#10b981";
    case "lost": return "#475569";
    case "negotiating":
    case "responded": return "#f59e0b";
    case "contacted":
    case "previewed": return "#22d3ee";
    default: return "#818cf8";
  }
}

interface Placed extends StarNode {
  x: number;
  y: number;
  r: number;
  cx: number; // cluster centroid
  cy: number;
}

export default function StarMap({ nodes }: { nodes: StarNode[] }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Placed | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const { placed, clusterCount } = useMemo(() => {
    const top = [...nodes].sort((a, b) => b.opportunity - a.opportunity).slice(0, MAX_NODES);

    // Stable angle per category; cluster (category|city) gets a centroid in that wedge.
    const cats = [...new Set(top.map((n) => n.category))];
    const catAngle = new Map(cats.map((c, i) => [c, (i / Math.max(1, cats.length)) * Math.PI * 2]));
    const clusterKeys = [...new Set(top.map((n) => `${n.category}|${n.city}`))];
    const clusterCentroid = new Map<string, { x: number; y: number }>();
    const cx0 = VIEW / 2;
    const cy0 = VIEW / 2;
    clusterKeys.forEach((key) => {
      const [cat] = key.split("|");
      const base = catAngle.get(cat) ?? 0;
      // deterministic spread within the wedge from a hash of the key
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      const jitter = ((h % 1000) / 1000 - 0.5) * 0.5;
      const ang = base + jitter;
      const rad = 230 + (h % 160);
      clusterCentroid.set(key, { x: cx0 + Math.cos(ang) * rad, y: cy0 + Math.sin(ang) * rad });
    });

    const placed: Placed[] = top.map((n, idx) => {
      const key = `${n.category}|${n.city}`;
      const c = clusterCentroid.get(key)!;
      let h = idx * 2654435761;
      h = h >>> 0;
      const a = (h % 628) / 100;
      const spread = 40 + ((h >> 4) % 70);
      // higher opportunity → pulled slightly toward its centroid (tighter, hotter)
      const pull = 1 - n.opportunity / 250;
      return {
        ...n,
        cx: c.x,
        cy: c.y,
        x: c.x + Math.cos(a) * spread * pull,
        y: c.y + Math.sin(a) * spread * pull,
        r: 5 + (n.opportunity / 100) * 9,
      };
    });
    return { placed, clusterCount: clusterKeys.length };
  }, [nodes]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  }
  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
  }
  function onUp() {
    drag.current = null;
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-slate-950/60 p-8 text-center text-sm text-slate-500">
        No signals mapped yet — discover businesses to populate the starmap.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-[#05070f]">
      <div className="flex items-center justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400/70">
        <span>Discovery starmap · {placed.length} signals · {clusterCount} clusters</span>
        <span className="flex gap-1">
          <button onClick={() => setZoom((z) => Math.min(4, z * 1.2))} className="rounded border border-cyan-500/30 px-1.5 hover:bg-cyan-500/10">+</button>
          <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))} className="rounded border border-cyan-500/30 px-1.5 hover:bg-cyan-500/10">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded border border-cyan-500/30 px-1.5 hover:bg-cyan-500/10">reset</button>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="h-[460px] w-full cursor-grab touch-none active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <defs>
          <radialGradient id="smCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: "center" }}>
          {/* core */}
          <circle cx={VIEW / 2} cy={VIEW / 2} r={70} fill="url(#smCore)" />
          <circle cx={VIEW / 2} cy={VIEW / 2} r={14} fill="#22d3ee" />
          {/* cluster spokes */}
          {placed.map((n) => (
            <line key={`l-${n.id}`} x1={n.x} y1={n.y} x2={n.cx} y2={n.cy} stroke="#1e3a5f" strokeWidth={0.6} strokeOpacity={0.5} />
          ))}
          {/* nodes */}
          {placed.map((n) => {
            const col = statusColor(n.status);
            const hot = n.opportunity >= 70;
            return (
              <g key={n.id} onClick={(e) => { e.stopPropagation(); setSelected(n); }} className="cursor-pointer">
                {hot && <circle cx={n.x} cy={n.y} r={n.r + 5} fill={col} fillOpacity={0.18} />}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={col}
                  fillOpacity={selected?.id === n.id ? 1 : 0.85}
                  stroke={selected?.id === n.id ? "#fff" : col}
                  strokeWidth={selected?.id === n.id ? 2 : 0}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {selected && (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-cyan-500/30 bg-slate-950/90 p-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{selected.name}</p>
              <p className="text-xs capitalize text-slate-400">
                {selected.category}{selected.city ? ` · ${selected.city}` : ""} · {selected.status}
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-lg font-bold text-cyan-300">{selected.opportunity}</span>
              <span className="block text-[10px] uppercase tracking-widest text-slate-500">opportunity</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Link href="/admin/prospects" className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 hover:text-cyan-300">
              open in pipeline ▸
            </Link>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-slate-300">close</button>
          </div>
        </div>
      )}
    </div>
  );
}
