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
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CaptionWord } from "./TikTokLayout";
import { getWordBackgroundStyle } from "./shared-styles";

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
    const span = container.querySelector("span")!;
    expect(span.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
    expect(span.style.borderRadius).toBe("8px");
    // bar padding overrides the default "0 2px" on the active word (intended)
    expect(span.style.padding).toBe("6px");
  });

  it("does not introduce a backgroundColor when wordBackgroundStyle is empty/absent (baseline unchanged)", () => {
    const { container } = render(
      <CaptionWord {...baseProps} wordBackgroundStyle={{}} />
    );
    const span = container.querySelector("span")!;
    expect(span.style.backgroundColor).toBe("");
    // pre-feature default padding intact
    expect(span.style.padding).toBe("0 2px");
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
