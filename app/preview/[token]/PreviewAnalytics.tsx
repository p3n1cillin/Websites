"use client";

import { useEffect } from "react";

/**
 * Client-side engagement beacon for a tokenised demo (Phase 3). Fires:
 *  • a "view" on mount,
 *  • "conversion" when the visitor taps a call / book / contact / email action,
 *  • a "dwell" with elapsed milliseconds when the tab is hidden or unloaded.
 *
 * Uses sendBeacon for the dwell so it survives the page closing. Entirely
 * fire-and-forget — failures are ignored (the API also degrades gracefully).
 */
export default function PreviewAnalytics({ token }: { token: string }) {
  useEffect(() => {
    const started = Date.now();

    const send = (type: string, extra: Record<string, unknown> = {}) => {
      const payload = JSON.stringify({ token, type, path: location.pathname, ...extra });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/preview/track", new Blob([payload], { type: "application/json" }));
        } else {
          void fetch("/api/preview/track", { method: "POST", body: payload, keepalive: true });
        }
      } catch {
        /* ignore */
      }
    };

    send("view");

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest("a");
      if (!el) return;
      const href = el.getAttribute("href") ?? "";
      let label: string | null = null;
      if (href.startsWith("tel:")) label = "call";
      else if (href.startsWith("mailto:")) label = "email";
      else if (href.includes("/book")) label = "book";
      else if (href.includes("/contact")) label = "contact";
      if (label) send("conversion", { label });
    };

    let dwellSent = false;
    const sendDwell = () => {
      if (dwellSent) return;
      dwellSent = true;
      send("dwell", { valueMs: Date.now() - started });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendDwell();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendDwell);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendDwell);
    };
  }, [token]);

  return null;
}
