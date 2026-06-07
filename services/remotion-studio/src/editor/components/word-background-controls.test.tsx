/**
 * word-background-controls.test.tsx — Phase 28-03 (SUB-01 / SUB-02)
 *
 * Guards the "Fondo por palabra" (per-word bar background) editor controls in
 * StyleControls. These drive config.wordBackground (engine + schema from 28-01)
 * and flow into the live preview via onChange → updateSubtitle → Player.
 *
 * Asserts:
 *  1. The "Fondo por palabra" FxBlock renders, off by default (apagado).
 *  2. Toggling it calls onChange({ wordBackground: { enabled: true, ... } }).
 *  3. The Transparencia / Radio / Relleno sliders + color input render when on
 *     and route their edits through onChange({ wordBackground }).
 *  4. Color law: no hardcoded #4CAF50 (Render-CTA green) on these controls.
 *
 * Color law: D-04 — subtitle controls use --accent (blue); --action green is the
 * Render CTA only.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StyleControls } from "./StyleControls.js";
import type { SubtitleConfig } from "../../pipeline-config.js";

const baseConfig: SubtitleConfig = {
  layout: "tiktok",
  fontFamily: "PlusJakartaSans",
  fontSize: 58,
  activeColor: "#FFFF00",
  inactiveColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
};

const enabledConfig: SubtitleConfig = {
  ...baseConfig,
  wordBackground: { enabled: true, color: "#000000", opacity: 0.6, borderRadius: 8, padding: 6 },
};

function fxHeadFor(container: HTMLElement, title: string): HTMLElement {
  const titleSpans = Array.from(container.querySelectorAll("span")).filter(
    (el) => el.textContent?.trim() === title
  );
  expect(titleSpans.length).toBeGreaterThan(0);
  const head = (titleSpans[0].closest("div[style*='cursor: pointer']") as HTMLElement)
    ?? (titleSpans[0].parentElement as HTMLElement);
  expect(head).toBeTruthy();
  return head;
}

describe("StyleControls — Fondo por palabra (Phase 28-03 SUB-01/02)", () => {
  it("renders the 'Fondo por palabra' FxBlock, off by default", () => {
    const { container } = render(<StyleControls config={baseConfig} onChange={vi.fn()} />);
    expect(container.textContent).toMatch(/Fondo por palabra/);
    // off-by-default: the block's collapsed hint reads "apagado" (FxBlock disabled)
    const head = fxHeadFor(container, "Fondo por palabra");
    expect(head.textContent).toMatch(/apagado/);
  });

  it("toggling the block calls onChange with wordBackground.enabled=true", () => {
    const onChange = vi.fn();
    const { container } = render(<StyleControls config={baseConfig} onChange={onChange} />);
    fireEvent.click(fxHeadFor(container, "Fondo por palabra"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wordBackground: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it("when enabled, exposes Transparencia / Radio / Relleno controls + a color input", () => {
    const { container } = render(<StyleControls config={enabledConfig} onChange={vi.fn()} />);
    expect(container.textContent).toMatch(/Transparencia/);
    // Radio + Relleno labels are shared with other blocks; assert via slider count + color input
    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThanOrEqual(5); // 4 cmatrix + glow/bh/wb when their blocks are open
    // The wb block contributes Transparencia/Radio/Relleno range inputs
    expect(screen.getAllByText("Radio").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Relleno").length).toBeGreaterThanOrEqual(1);
  });

  it("editing opacity routes through onChange({ wordBackground })", () => {
    const onChange = vi.fn();
    render(<StyleControls config={enabledConfig} onChange={onChange} />);
    // Transparencia is a range row; find it via its label's sibling slider.
    const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]')) as HTMLInputElement[];
    // The Transparencia slider has min=0 max=1 step=0.05 — unique within the block set.
    const opacitySlider = rangeInputs.find(
      (r) => r.min === "0" && r.max === "1" && r.step === "0.05" && r.value === "0.6"
    );
    expect(opacitySlider).toBeTruthy();
    fireEvent.change(opacitySlider!, { target: { value: "0.3" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wordBackground: expect.objectContaining({ opacity: 0.3 }),
      })
    );
  });

  it("editing color routes through onChange({ wordBackground })", () => {
    const onChange = vi.fn();
    const { container } = render(<StyleControls config={enabledConfig} onChange={onChange} />);
    // wb color input has its current value #000000; find a color input with that value
    // inside the Fondo por palabra block region (last color input belongs to wb block).
    const colorInputs = Array.from(container.querySelectorAll('input[type="color"]')) as HTMLInputElement[];
    const wbColor = colorInputs[colorInputs.length - 1];
    fireEvent.change(wbColor, { target: { value: "#ff0000" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        wordBackground: expect.objectContaining({ color: "#ff0000" }),
      })
    );
  });

  it("does NOT use the Render-CTA green (#4CAF50) on the word-background controls", () => {
    const { container } = render(<StyleControls config={enabledConfig} onChange={vi.fn()} />);
    const allStyles = Array.from(container.querySelectorAll("[style]"))
      .map((el) => (el as HTMLElement).getAttribute("style") ?? "")
      .join(" ");
    expect(allStyles).not.toMatch(/#4CAF50/i);
  });
});
