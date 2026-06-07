// ─── CollapsibleSection: reusable disclosure (Phase 29 — FONT-01/02) ──────────
// A PURE expand/collapse disclosure, NOT an on/off toggle. Unlike FxBlock's
// switch idiom (which reads as "activado/apagado" and would wrongly imply the
// section is disabled), this is a chevron that rotates: ▸ collapsed / ▾ expanded.
// Collapse ≠ disable — the body is simply hidden until the user expands it.
//
// Design-system discipline (sketch-findings-reel-factory + impeccable):
//   - Neutral / --accent tokens ONLY. NEVER the action-green token (reserved for
//     the Render CTA in the header).
//   - OKLCH token set inlined in index.html (--surface/--border/--text/--accent/--s-*/--t-*).
//   - Bordered card with FULL borders (no side-stripe). Header padding matches FxBlock.
//   - Chevron rotates via transform (≤250ms ease-out); disabled under reduced-motion.
//   - Collapsed body is ABSENT from the DOM (conditional render), mirroring FxBlock's
//     `{enabled && (...)}` — so the section truly reclaims vertical space when closed.

import React, { useState } from "react";

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Respect prefers-reduced-motion: drop the chevron transition for users who
  // opt out. Read once per render (cheap; matchMedia is synchronous).
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{
        border: "1px solid var(--border, #333)",
        borderRadius: "var(--r-sm, 6px)",
        background: "var(--surface, #1e1e2e)",
        marginBottom: "var(--s-5, 10px)",
        overflow: "hidden",
      }}
    >
      {/* Disclosure header — a real <button> so it is keyboard-operable and
          query-able as role="button" with an accessible name === title. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-5, 10px)",
          width: "100%",
          padding: "var(--s-5, 10px) var(--s-6, 12px)",
          margin: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
          color: "var(--text, #e6e6ea)",
        }}
      >
        {/* Chevron: ▸ collapsed → rotates to ▾ expanded (90° CW). */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            flexShrink: 0,
            fontSize: "var(--t-2xs, 10.5px)" as React.CSSProperties["fontSize"],
            color: "var(--text-2, #a8a8b3)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: reduceMotion
              ? "none"
              : "transform var(--dur, 170ms) var(--ease, ease-out)",
          }}
        >
          ▸
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--t-sm, 12.5px)" as React.CSSProperties["fontSize"],
            fontWeight: 600,
            color: open ? "var(--accent, #90caf9)" : "var(--text, #e6e6ea)",
            transition: reduceMotion
              ? "none"
              : "color var(--dur, 170ms) var(--ease, ease-out)",
          }}
        >
          {title}
        </span>
      </button>

      {/* Body — present in the DOM ONLY when expanded. */}
      {open && (
        <div style={{ padding: "0 var(--s-6, 12px) var(--s-6, 12px)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
