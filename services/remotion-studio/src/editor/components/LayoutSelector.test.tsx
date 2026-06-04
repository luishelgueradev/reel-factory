/**
 * LayoutSelector.test.tsx — Color-law regression guard (Phase 26-01/26-02)
 *
 * Asserts:
 *  1. The LayoutSelector renders as blue-active preset cards (sketch 011-C, Phase 26-02).
 *  2. The active state uses the --accent (blue) token and NOT the green #4CAF50
 *     that was the documented D-04 violation.
 *  3. All four layout mode cards render and selecting one calls onChange with
 *     the correct SubtitleLayoutMode value.
 *  4. A11y: radiogroup container, each card is role="radio" with aria-checked.
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

describe("LayoutSelector — preset cards 011-C + color-law regression (26-02, D-04)", () => {
  it("renders without crashing", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders all four layout mode card labels", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    expect(screen.getByText("TikTok")).toBeTruthy();
    expect(screen.getByText("Sentence")).toBeTruthy();
    expect(screen.getByText("Bar")).toBeTruthy();
    expect(screen.getByText("Karaoke")).toBeTruthy();
  });

  it("renders a radiogroup with four radio cards", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
  });

  it("the selected card has data-selected=true and others have data-selected=false", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="bar" onChange={onChange} />
    );
    const selectedCards = Array.from(
      container.querySelectorAll("[data-selected='true']")
    );
    const unselectedCards = Array.from(
      container.querySelectorAll("[data-selected='false']")
    );
    expect(selectedCards).toHaveLength(1);
    expect(unselectedCards).toHaveLength(3);
  });

  it("the selected card has aria-checked=true", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="sentence" onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    const checkedRadios = radios.filter(
      (r) => r.getAttribute("aria-checked") === "true"
    );
    expect(checkedRadios).toHaveLength(1);
    expect(checkedRadios[0].getAttribute("data-mode")).toBe("sentence");
  });

  it("the selected card uses --accent border, NOT #4CAF50 green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const selected = container.querySelector('[data-selected="true"]');
    expect(selected).toBeTruthy();

    const fullStyle = (selected as HTMLElement).getAttribute("style") ?? "";

    // Must NOT contain green values (the documented D-04 violation)
    expect(fullStyle).not.toMatch(/#4CAF50/i);
    expect(fullStyle).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    // Must use --accent or the blue fallback
    expect(fullStyle).toMatch(/var\(--accent/);
  });

  it("the selected card bg uses --accent-tint, NOT rgba(76,175,80,...) green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="sentence" onChange={onChange} />
    );
    const selected = container.querySelector('[data-selected="true"]');
    expect(selected).toBeTruthy();

    const fullStyle = (selected as HTMLElement).getAttribute("style") ?? "";

    expect(fullStyle).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    // Active bg uses --accent-tint-2 (prefixed with --accent-tint)
    expect(fullStyle).toMatch(/var\(--accent-tint/);
  });

  it("the selected card label uses --accent color, NOT #a5d6a7 green-tint", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="karaoke" onChange={onChange} />
    );
    const selected = container.querySelector('[data-selected="true"]');
    expect(selected).toBeTruthy();

    // The mode name is in the LAST span inside the button (directly under button,
    // not nested inside the .mc-vis div). Use querySelectorAll + last item.
    const allSpans = selected?.querySelectorAll("span");
    expect(allSpans).toBeTruthy();
    // The mode-name span is a direct child of the button (not inside the mc-vis div)
    const buttonEl = selected as HTMLButtonElement;
    const directSpans = Array.from(buttonEl.children).filter(
      (el) => el.tagName === "SPAN"
    );
    expect(directSpans.length).toBeGreaterThan(0);
    const nameSpan = directSpans[directSpans.length - 1];

    const textStyle = (nameSpan as HTMLElement).getAttribute("style") ?? "";
    expect(textStyle).not.toMatch(/#a5d6a7/i);
    expect(textStyle).toMatch(/var\(--accent/);
  });

  it("clicking a card calls onChange with the correct layout value", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    // Click the "bar" card — using data-mode attribute
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const barCard = container.querySelector('[data-mode="bar"]') as HTMLElement;
    expect(barCard).toBeTruthy();
    fireEvent.click(barCard);
    expect(onChange).toHaveBeenCalledWith("bar");
  });

  it("each card has the correct data-mode value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const modes = ["tiktok", "sentence", "bar", "karaoke"];
    modes.forEach((mode) => {
      const card = container.querySelector(`[data-mode="${mode}"]`);
      expect(card).toBeTruthy();
    });
  });
});
