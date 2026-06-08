/**
 * tiktok-word-background.test.tsx — Phase 28 SUB-01/02
 *
 * Verifies the per-word "fondo por palabra" bar is wired into the tiktok word
 * span: when a wordBackgroundStyle is supplied, the active word's rendered
 * <span> carries the bar (backgroundColor); when absent it does not, and the
 * pre-feature styling (the "0 2px" padding default) is untouched.
 *
 * CaptionWord has no Remotion hooks, so it renders cleanly in jsdom — this is a
 * focused render-smoke of the spread point. The rgba math is covered by the
 * getWordBackgroundStyle unit tests; the renderer parity is covered by Task 3.
 */

import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CaptionWord } from "./TikTokLayout";
import { getWordBackgroundStyle, WORD_BG_LINE_HEIGHT } from "./shared-styles";

const baseProps = {
  text: "hola",
  isActive: true,
  wasActive: false,
  framesSinceActive: 0,
  framesSinceActivated: 0,
  fontSize: 58,
  color: "#FFFF00",
  outlineColor: "#000000",
  outlineWidth: 3,
  pastWordOpacity: 0.4,
  fps: 30,
};

describe("TikTokLayout per-word bar background (SUB-01/02)", () => {
  it("renders the bar backgroundColor on the active word when wordBackgroundStyle is supplied", () => {
    const wordBg = getWordBackgroundStyle(
      { enabled: true, color: "#000000", opacity: 0.5, borderRadius: 8, padding: 6 },
      true
    );
    const { container } = render(
      <CaptionWord {...baseProps} wordBackgroundStyle={wordBg} />
    );
    // The bar lives on an inner span that hugs the word; find the span carrying it.
    const spans = [...container.querySelectorAll("span")];
    const barSpan = spans.find((s) => s.style.backgroundColor !== "")!;
    expect(barSpan).toBeTruthy();
    expect(barSpan.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
    expect(barSpan.style.borderRadius).toBe("8px");
    // box-shadow spread ring hugs the word symmetrically (no padding/negative-margin)
    expect(barSpan.style.boxShadow).toBe("0 0 0 6px rgba(0, 0, 0, 0.5)");
    expect(barSpan.style.padding).toBe("");
    expect(barSpan.style.margin).toBe("");
    // tight line-height hugs the glyph vertically so T/B padding ≈ L/R (260608-ka1)
    expect(barSpan.style.lineHeight).toBe(String(WORD_BG_LINE_HEIGHT));
  });

  it("keeps leading/trailing whitespace OUTSIDE the bar so it hugs the word symmetrically", () => {
    const wordBg = getWordBackgroundStyle(
      { enabled: true, color: "#000000", opacity: 0.5, borderRadius: 8, padding: 6 },
      true
    );
    const { container } = render(
      <CaptionWord {...baseProps} text=" hola " wordBackgroundStyle={wordBg} />
    );
    const spans = [...container.querySelectorAll("span")];
    const barSpan = spans.find((s) => s.style.backgroundColor !== "")!;
    // the bar wraps ONLY the trimmed word — no swallowed leading/trailing space
    expect(barSpan.textContent).toBe("hola");
    // the inter-word spacing is preserved overall (rendered outside the bar)
    expect(container.textContent).toBe(" hola ");
  });

  it("does not introduce a backgroundColor when wordBackgroundStyle is empty/absent (baseline unchanged)", () => {
    const { container } = render(
      <CaptionWord {...baseProps} wordBackgroundStyle={{}} />
    );
    const span = container.querySelector("span")!;
    expect(span.style.backgroundColor).toBe("");
    // pre-feature default padding intact (jsdom serializes "0 2px" → "0px 2px")
    expect(span.style.padding).toBe("0px 2px");
  });

  it("never paints the bar on an inactive word (getWordBackgroundStyle returns {} for isActive=false)", () => {
    const wordBg = getWordBackgroundStyle(
      { enabled: true, color: "#000000", opacity: 0.5, borderRadius: 8, padding: 6 },
      false
    );
    const { container } = render(
      <CaptionWord {...baseProps} isActive={false} color="#FFFFFF" wordBackgroundStyle={wordBg} />
    );
    const span = container.querySelector("span")!;
    expect(span.style.backgroundColor).toBe("");
  });
});

// ─── Item 5: flash-off default → active word shows activeColor immediately ───
//
// With highlightDurationMs = 0 (the new default) or unset, the highlight flash
// is disabled, so the active word's rendered color is its `color` prop
// (= activeColor at the CaptionPage call site), NOT the white highlightColor.
// A config with highlightDurationMs > 0 still flashes (capability preserved).

describe("TikTokLayout active-word color (item 5 — flash off by default)", () => {
  it("renders the active color immediately when highlightDurationMs is 0 (no flash)", () => {
    const { container } = render(
      <CaptionWord
        {...baseProps}
        color="#FFFF00" // activeColor
        highlightColor="#FFFFFF"
        highlightDurationMs={0}
        highlightTransition="fade"
      />
    );
    const span = container.querySelector("span")!;
    // activeColor (#FFFF00) painted directly — NOT the white highlightColor flash
    expect(span.style.color).toBe("rgb(255, 255, 0)");
  });

  it("renders the active color immediately when highlightDurationMs is unset (no flash)", () => {
    const { container } = render(
      <CaptionWord
        {...baseProps}
        color="#FFFF00"
        highlightColor="#FFFFFF"
        // highlightDurationMs intentionally omitted (?? 0 → 0)
        highlightTransition="fade"
      />
    );
    const span = container.querySelector("span")!;
    expect(span.style.color).toBe("rgb(255, 255, 0)");
  });

  it("still flashes the highlightColor on frame 0 when highlightDurationMs > 0 (capability preserved)", () => {
    const { container } = render(
      <CaptionWord
        {...baseProps}
        color="#FFFF00"
        highlightColor="#FFFFFF"
        highlightDurationMs={200}
        highlightTransition="instant"
        framesSinceActivated={0}
      />
    );
    const span = container.querySelector("span")!;
    // instant transition on frame 0 → the white highlight flash is visible
    expect(span.style.color).toBe("rgb(255, 255, 255)");
  });
});

// ─── Item 4: tiktok parent div no longer paints the full-phrase bg ───────────
//
// The full-phrase backgroundHighlight (getBackgroundHighlightStyle) must NOT be
// spread onto the tiktok CaptionPage parent <div> — even for existing configs
// that enable it. CaptionPage uses Remotion hooks (can't render in jsdom), so we
// assert the source no longer wires the full-phrase bg into the layout. The
// per-word wordBackground path (getWordBackgroundStyle) must remain intact.

describe("TikTokLayout source: full-phrase bg removed for tiktok (item 4)", () => {
  const src = readFileSync(join(__dirname, "TikTokLayout.tsx"), "utf8");

  it("does not spread bgHighlightStyles onto the CaptionPage parent div", () => {
    expect(src).not.toMatch(/\.\.\.bgHighlightStyles/);
  });

  it("does not call getBackgroundHighlightStyle (full-phrase bg) in the tiktok layout", () => {
    expect(src).not.toMatch(/getBackgroundHighlightStyle\s*\(/);
  });

  it("keeps the per-word wordBackground path intact", () => {
    expect(src).toMatch(/getWordBackgroundStyle\s*\(/);
  });
});
