/**
 * LayoutSelector.test.tsx — Color-law regression guard (Phase 26-01)
 *
 * Asserts that the LayoutSelector active state uses the --accent (blue) token
 * and NOT the green #4CAF50 / rgba(76,175,80,...) that was the documented D-04
 * violation. This test fails if the active state reverts to green.
 *
 * Color law: D-04 / 26-UI-SPEC.md
 *   --accent (blue) = all selection/focus/active states
 *   --action (green) = CTA only (Render, Guardar, cold-start "Elegir archivo")
 *   Zero hardcoded #4CAF50/green on any active state.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutSelector } from "./LayoutSelector.js";

describe("LayoutSelector — color-law regression (26-01, D-04)", () => {
  it("renders without crashing", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders all four layout options", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    expect(screen.getByText("TikTok")).toBeTruthy();
    expect(screen.getByText("Sentence")).toBeTruthy();
    expect(screen.getByText("Bar")).toBeTruthy();
    expect(screen.getByText("Karaoke")).toBeTruthy();
  });

  it("the selected option has data-selected=true and unselected have data-selected=false", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="bar" onChange={onChange} />
    );
    const labels = container.querySelectorAll("label");
    const selectedLabels = Array.from(labels).filter(
      (l) => l.dataset.selected === "true"
    );
    const unselectedLabels = Array.from(labels).filter(
      (l) => l.dataset.selected === "false"
    );
    expect(selectedLabels).toHaveLength(1);
    expect(unselectedLabels).toHaveLength(3);
  });

  it("the selected option uses --accent border, NOT #4CAF50 green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const selected = container.querySelector('label[data-selected="true"]');
    expect(selected).toBeTruthy();

    const borderStyle = (selected as HTMLElement).style.borderColor;
    const fullStyle = (selected as HTMLElement).getAttribute("style") ?? "";

    // Must NOT contain green values (the documented violation)
    expect(fullStyle).not.toMatch(/#4CAF50/i);
    expect(fullStyle).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    // Must use --accent or the blue fallback
    expect(fullStyle).toMatch(/var\(--accent/);

    // borderColor from computed style is NOT checked here (jsdom doesn't resolve
    // CSS custom properties), so we validate the source style attribute directly.
    void borderStyle; // acknowledged: jsdom returns empty string for var(...)
  });

  it("the selected option bg uses --accent-tint, NOT rgba(76,175,80,...) green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="sentence" onChange={onChange} />
    );
    const selected = container.querySelector('label[data-selected="true"]');
    expect(selected).toBeTruthy();

    const fullStyle = (selected as HTMLElement).getAttribute("style") ?? "";

    expect(fullStyle).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    expect(fullStyle).toMatch(/var\(--accent-tint/);
  });

  it("the selected label text uses --accent color, NOT #a5d6a7 green-tint", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="karaoke" onChange={onChange} />
    );
    const selected = container.querySelector('label[data-selected="true"]');
    expect(selected).toBeTruthy();

    // The label text div is the first div child
    const labelText = selected?.querySelector("div div:first-child");
    expect(labelText).toBeTruthy();

    const textStyle = (labelText as HTMLElement).getAttribute("style") ?? "";
    expect(textStyle).not.toMatch(/#a5d6a7/i);
    expect(textStyle).toMatch(/var\(--accent/);
  });

  it("calling onChange with a different layout calls the callback", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    // Click the radio input for "bar"
    const radios = screen.getAllByRole("radio");
    const barRadio = radios.find((r) => (r as HTMLInputElement).value === "bar");
    expect(barRadio).toBeTruthy();
    fireEvent.click(barRadio!);
    expect(onChange).toHaveBeenCalledWith("bar");
  });
});
