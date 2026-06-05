/**
 * title-density.test.tsx — Phase 26-04 UICONV-01 density layout regression guard
 *
 * Asserts:
 *  1. TitleEditor form (when open) renders a 2-column grid container (data-ctrl-2col).
 *  2. StyleControls renders a 2-column grid container (data-ctrl-2col).
 *  3. Both colwrap columns are present (data-colwrap="left" + data-colwrap="right").
 *  4. All key TitleEditor inputs still exist (text, font, x, y, entrance cards,
 *     glow toggle, timing, border-radius, padding, line-height, color inputs).
 *  5. All key StyleControls inputs still exist (font, size, color swatches,
 *     position preset, effects toggle).
 *  6. No hardcoded green (#4CAF50) on any active state (color law D-04).
 *
 * Color law: D-04 / 26-UI-SPEC.md
 *   --accent (blue) = all selection/focus/active states
 *   --action (green) = CTA only
 *   Zero hardcoded #4CAF50/green on any active state.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TitleEditor } from "./TitleEditor.js";
import { StyleControls } from "./StyleControls.js";

// ─── TitleEditor density tests ────────────────────────────────────────────────

describe("TitleEditor — sketch 014-C dense 2-col layout (26-04 UICONV-01)", () => {
  function openForm() {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor titles={[]} onChange={onChange} />
    );
    // Click "＋ Agregar título" to open the form (exact match to avoid ambiguity with form submit)
    const addBtn = screen.getByText("＋ Agregar título");
    fireEvent.click(addBtn);
    return { container, onChange };
  }

  it("renders without crashing", () => {
    const { container } = render(
      <TitleEditor titles={[]} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the add-title button when no titles and form closed", () => {
    render(<TitleEditor titles={[]} onChange={vi.fn()} />);
    // Use exact match to get only the button (not the empty-state paragraph text)
    expect(screen.getByText("＋ Agregar título")).toBeTruthy();
  });

  it("form contains a data-ctrl-2col grid container after opening", () => {
    const { container } = openForm();
    const grid = container.querySelector("[data-ctrl-2col]");
    expect(grid).toBeTruthy();
  });

  it("form grid uses grid-template-columns with two 1fr tracks", () => {
    const { container } = openForm();
    const grid = container.querySelector("[data-ctrl-2col]") as HTMLElement;
    expect(grid).toBeTruthy();
    const style = grid.getAttribute("style") ?? "";
    // Must use a grid with two 1fr columns
    expect(style).toMatch(/grid-template-columns/);
    expect(style).toMatch(/1fr 1fr/);
  });

  it("both colwrap columns are present (left + right)", () => {
    const { container } = openForm();
    expect(container.querySelector('[data-colwrap="left"]')).toBeTruthy();
    expect(container.querySelector('[data-colwrap="right"]')).toBeTruthy();
  });

  it("entrance preset cards render as radiogroup with 4 radios", () => {
    openForm();
    const group = screen.getByRole("radiogroup", { name: /animación de entrada/i });
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThanOrEqual(4);
  });

  it("Slide ↑ entrance card is selected by default", () => {
    const { container } = openForm();
    const selected = container.querySelector('[data-selected="true"]');
    expect(selected).toBeTruthy();
    expect(selected?.getAttribute("data-entrance")).toBe("slide-up");
  });

  it("active entrance card uses --accent color, NOT #4CAF50 green", () => {
    const { container } = openForm();
    const selected = container.querySelector('[data-selected="true"]') as HTMLElement;
    expect(selected).toBeTruthy();
    const style = selected.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#4CAF50/i);
    expect(style).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    expect(style).toMatch(/var\(--accent/);
  });

  it("text input for title exists in the form", () => {
    openForm();
    const textInput = screen.getByPlaceholderText(/bienvenido/i);
    expect(textInput).toBeTruthy();
  });

  it("font select exists in the form", () => {
    const { container } = openForm();
    // Select element for font (right column)
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it("X and Y number inputs exist in the form", () => {
    const { container } = openForm();
    const numberInputs = Array.from(container.querySelectorAll('input[type="number"]'));
    // Should have at least X, Y, Aparece, Duración (4 number inputs)
    expect(numberInputs.length).toBeGreaterThanOrEqual(4);
  });

  it("range inputs exist for tamaño, radio, relleno, interlínea", () => {
    const { container } = openForm();
    const ranges = container.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBeGreaterThanOrEqual(3);
  });

  it("color inputs exist for text and box colors", () => {
    const { container } = openForm();
    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("Cancelar button is present in the open form", () => {
    openForm();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("clicking Cancelar closes the form", () => {
    const { container } = openForm();
    const cancelBtn = screen.getByText("Cancelar");
    fireEvent.click(cancelBtn);
    expect(container.querySelector("[data-ctrl-2col]")).toBeNull();
  });

  it("does NOT render #4CAF50 green anywhere in the open form", () => {
    const { container } = openForm();
    const allStyles = Array.from(container.querySelectorAll("[style]"))
      .map((el) => (el as HTMLElement).getAttribute("style") ?? "")
      .join(" ");
    expect(allStyles).not.toMatch(/#4CAF50/i);
  });
});

// ─── StyleControls density tests ─────────────────────────────────────────────

describe("StyleControls — sketch 011-C dense 2-col layout (26-04 UICONV-01)", () => {
  const defaultConfig = {
    layout: "tiktok" as const,
    fontFamily: "PlusJakartaSans",
    fontSize: 58,
    activeColor: "#FFFF00",
    inactiveColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 3,
  };

  it("renders without crashing", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a data-ctrl-2col grid container at the top level", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const grid = container.querySelector("[data-ctrl-2col]");
    expect(grid).toBeTruthy();
  });

  it("grid uses grid-template-columns with two 1fr tracks", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const grid = container.querySelector("[data-ctrl-2col]") as HTMLElement;
    const style = grid.getAttribute("style") ?? "";
    expect(style).toMatch(/grid-template-columns/);
    expect(style).toMatch(/1fr 1fr/);
  });

  it("both colwrap columns are present (left + right)", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    expect(container.querySelector('[data-colwrap="left"]')).toBeTruthy();
    expect(container.querySelector('[data-colwrap="right"]')).toBeTruthy();
  });

  it("font select is present", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it("font size range input is present", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const ranges = container.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  it("color swatch inputs are present (at least 4 for the cmatrix)", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const colorInputs = container.querySelectorAll('input[type="color"]');
    expect(colorInputs.length).toBeGreaterThanOrEqual(4);
  });

  it("glow fx block renders with toggle switch", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    // The glow block shows "Glow exterior" text and "apagado" hint
    expect(container.textContent).toMatch(/Glow exterior/);
    expect(container.textContent).toMatch(/apagado/);
  });

  it("enabling glow calls onChange with outerGlow.enabled=true", () => {
    const onChange = vi.fn();
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={onChange} />
    );
    // The FxBlock toggle is the outermost div with a cursor:pointer fx-head div
    // Find it by looking for any element containing "Glow exterior" text that is clickable
    // The fx-head div is a direct child of the fx block div and has onClick set
    // Use getAllByText to find the "Glow exterior" span then click its parent div
    const glowTexts = Array.from(container.querySelectorAll("span")).filter(
      (el) => el.textContent?.trim() === "Glow exterior"
    );
    expect(glowTexts.length).toBeGreaterThan(0);
    // The clickable fx-head is the parent div of the span
    const fxHead = glowTexts[0].closest("div[style*='cursor: pointer']") as HTMLElement
      ?? glowTexts[0].parentElement as HTMLElement;
    expect(fxHead).toBeTruthy();
    fireEvent.click(fxHead);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        outerGlow: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it("Reg / Bold / It style buttons are present", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    expect(container.textContent).toMatch(/Reg/);
    expect(container.textContent).toMatch(/Bold/);
    expect(container.textContent).toMatch(/It/);
  });

  it("Bold is active by default (fontWeight not false)", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    // segBtnStyle active uses var(--accent-strong)
    const boldBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === "Bold"
    );
    expect(boldBtns.length).toBeGreaterThan(0);
    const boldStyle = (boldBtns[0] as HTMLElement).getAttribute("style") ?? "";
    expect(boldStyle).toMatch(/var\(--accent/);
    expect(boldStyle).not.toMatch(/#4CAF50/i);
  });

  it("does NOT render #4CAF50 green anywhere", () => {
    const { container } = render(
      <StyleControls config={defaultConfig} onChange={vi.fn()} />
    );
    const allStyles = Array.from(container.querySelectorAll("[style]"))
      .map((el) => (el as HTMLElement).getAttribute("style") ?? "")
      .join(" ");
    expect(allStyles).not.toMatch(/#4CAF50/i);
  });
});
