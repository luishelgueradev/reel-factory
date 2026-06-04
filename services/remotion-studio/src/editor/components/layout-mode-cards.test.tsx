/**
 * layout-mode-cards.test.tsx — Preset cards integration tests (Phase 26-02)
 *
 * Tests the specimen-driven preset card pattern for:
 *  1. Subtitle layout modes (LayoutSelector, sketch 011-C) within StyleControls
 *  2. Title entrance animation (TitleEditor, sketch 014-C)
 *
 * Per plan 26-02 acceptance criteria:
 *  - Layout mode cards and entrance cards render
 *  - Selecting a card calls onChange with the correct config value
 *  - The active card uses --accent (blue), NOT green
 *  - All prior config fields still render (no regressions)
 *
 * Color law: D-04 / 26-UI-SPEC.md
 *   --accent (blue) = all selection/focus/active states
 *   --action (green) = CTA only
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayoutSelector } from "./LayoutSelector.js";
import { StyleControls } from "./StyleControls.js";
import { TitleEditor } from "./TitleEditor.js";
import type { SubtitleConfig } from "../../pipeline-config.js";

// ─── Minimal valid SubtitleConfig for testing ─────────────────────────────────

const BASE_SUBTITLE_CONFIG: SubtitleConfig = {
  layout: "tiktok",
  fontFamily: "PlusJakartaSans",
  fontSize: 58,
  activeColor: "#FFFF00",
  inactiveColor: "#FFFFFF",
  highlightColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  position: "bottom-center",
  bottomOffset: 250,
  letterSpacing: 0,
  lineHeight: 1.3,
  highlightDurationMs: 200,
  highlightTransition: "fade",
  pastWordOpacity: 0.4,
  subtitleWidth: 0,
};

// ─── Helper: open the TitleEditor's add form ────────────────────────────────

function openAddForm(container: HTMLElement) {
  // The add button has the unicode "＋" character
  const addBtn = container.querySelector('button[type="button"]') as HTMLButtonElement;
  // Find by the dashed border (add button style)
  const dashedBtn = Array.from(container.querySelectorAll('button[type="button"]')).find(
    (b) => {
      const style = (b as HTMLElement).getAttribute("style") ?? "";
      return style.includes("dashed");
    }
  ) as HTMLButtonElement | undefined;
  if (dashedBtn) fireEvent.click(dashedBtn);
  return !!dashedBtn;
}

// ─── Suite 1: LayoutSelector inside StyleControls context ─────────────────────

describe("Subtitle layout-mode preset cards (011-C) — LayoutSelector", () => {
  it("renders all four layout mode cards in a radiogroup", () => {
    const onChange = vi.fn();
    render(<LayoutSelector value="tiktok" onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
  });

  it("renders layout mode cards alongside StyleControls subtitle form", () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <LayoutSelector value="tiktok" onChange={onChange} />
        <StyleControls config={BASE_SUBTITLE_CONFIG} onChange={onChange} />
      </>
    );
    // Cards present
    expect(screen.getByText("TikTok")).toBeTruthy();
    expect(screen.getByText("Sentence")).toBeTruthy();
    expect(screen.getByText("Bar")).toBeTruthy();
    expect(screen.getByText("Karaoke")).toBeTruthy();
    // StyleControls form section headers still render (use getAllByText since there may be multiple)
    expect(screen.getAllByText(/posición/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/estilo/i).length).toBeGreaterThan(0);
    void container;
  });

  it("selecting a layout mode card calls onChange with the correct value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const barCard = container.querySelector('[data-mode="bar"]') as HTMLElement;
    expect(barCard).toBeTruthy();
    fireEvent.click(barCard);
    expect(onChange).toHaveBeenCalledWith("bar");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("the active layout card uses --accent (blue), NOT green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="sentence" onChange={onChange} />
    );
    const activeCard = container.querySelector('[data-selected="true"]');
    expect(activeCard).toBeTruthy();

    const style = (activeCard as HTMLElement).getAttribute("style") ?? "";
    // No green values
    expect(style).not.toMatch(/#4CAF50/i);
    expect(style).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    // Blue accent
    expect(style).toMatch(/var\(--accent/);
  });

  it("inactive layout cards do NOT use accent border colors", () => {
    const onChange = vi.fn();
    const { container } = render(
      <LayoutSelector value="tiktok" onChange={onChange} />
    );
    const inactiveCards = container.querySelectorAll('[data-selected="false"]');
    expect(inactiveCards.length).toBe(3);
    inactiveCards.forEach((card) => {
      const style = (card as HTMLElement).getAttribute("style") ?? "";
      expect(style).not.toMatch(/var\(--accent-strong/);
      expect(style).not.toMatch(/var\(--accent-tint/);
    });
  });
});

// ─── Suite 2: TitleEditor entrance animation preset cards (014-C) ─────────────

describe("Title entrance-animation preset cards (014-C) — TitleEditor", () => {
  it("renders the TitleEditor add button when no titles exist", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onChange}
      />
    );
    // The add button with dashed border
    const dashedBtn = Array.from(container.querySelectorAll('button[type="button"]')).find(
      (b) => ((b as HTMLElement).getAttribute("style") ?? "").includes("dashed")
    );
    expect(dashedBtn).toBeTruthy();
    void onChange;
  });

  it("opening the add form reveals the entrance animation cards", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onChange}
      />
    );
    openAddForm(container);
    // Entrance animation radiogroup
    expect(screen.getByRole("radiogroup", { name: /animación de entrada/i })).toBeTruthy();
    // All 4 entrance options present
    expect(screen.getByText("Slide ↑")).toBeTruthy();
    expect(screen.getByText("Slide ↓")).toBeTruthy();
    expect(screen.getByText("Fade")).toBeTruthy();
    expect(screen.getByText("Ninguna")).toBeTruthy();
  });

  it("entrance animation cards render as role=radio buttons inside the radiogroup", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onChange}
      />
    );
    openAddForm(container);
    const radiogroup = screen.getByRole("radiogroup", { name: /animación de entrada/i });
    const radioButtons = radiogroup.querySelectorAll('[role="radio"]');
    expect(radioButtons).toHaveLength(4);
  });

  it("selecting a Fade entrance card sets data-selected=true on that card", () => {
    const onTitlesChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onTitlesChange}
      />
    );
    openAddForm(container);

    // Click fade-in entrance card
    const fadeCard = container.querySelector('[data-entrance="fade-in"]') as HTMLElement;
    expect(fadeCard).toBeTruthy();
    fireEvent.click(fadeCard);
    // After click, the fade-in card should be selected
    expect(fadeCard.getAttribute("aria-checked")).toBe("true");
    expect(fadeCard.getAttribute("data-selected")).toBe("true");
  });

  it("the active entrance card (slide-up default) uses --accent (blue), NOT green", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onChange}
      />
    );
    openAddForm(container);

    // Default is slide-up — it should be the initially active card
    const activeCard = container.querySelector('[data-entrance="slide-up"][data-selected="true"]');
    expect(activeCard).toBeTruthy();

    const style = (activeCard as HTMLElement).getAttribute("style") ?? "";
    // No green
    expect(style).not.toMatch(/#4CAF50/i);
    expect(style).not.toMatch(/rgba\(\s*76\s*,\s*175\s*,\s*80/i);
    // Blue accent border
    expect(style).toMatch(/var\(--accent/);
  });

  it("all prior form fields still render when entrance cards are present", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[]}
        onChange={onChange}
      />
    );
    openAddForm(container);
    // Timing inputs (Aparece / Dura) in the Avanzado section
    const inputs = container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBeGreaterThanOrEqual(2); // At least Aparece + Dura + X/Y
    // Position section still present
    expect(screen.getAllByText(/posición/i).length).toBeGreaterThan(0);
    // Estilo section still present
    expect(screen.getAllByText(/estilo/i).length).toBeGreaterThan(0);
    // Cancel button still present
    expect(screen.getByText(/cancelar/i)).toBeTruthy();
  });

  it("editing an existing title with fade-in preserves the correct selected card", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TitleEditor
        titles={[{
          text: "Título de prueba",
          startTimeMs: 0,
          durationMs: 3000,
          style: { entranceAnimation: "fade-in" },
        }]}
        onChange={onChange}
      />
    );
    // Click edit on the first title
    const editBtn = screen.getByText("Editar");
    fireEvent.click(editBtn);

    // The fade-in card should now be selected
    const fadeCard = container.querySelector('[data-entrance="fade-in"]') as HTMLElement;
    expect(fadeCard).toBeTruthy();
    expect(fadeCard.getAttribute("data-selected")).toBe("true");
    expect(fadeCard.getAttribute("aria-checked")).toBe("true");

    // The slide-up card should NOT be selected
    const slideUpCard = container.querySelector('[data-entrance="slide-up"]') as HTMLElement;
    expect(slideUpCard.getAttribute("data-selected")).toBe("false");
  });
});
