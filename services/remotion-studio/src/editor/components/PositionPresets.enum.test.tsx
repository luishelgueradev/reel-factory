// ─── PositionPresets — enum-mode click mapping tests ─────────────────────────
// Tests for the subtitle enum-mode path (D-08: enum mode for subtitles).
// Covers: anchorToValue → onApplyAnchor mapping, disabled cells, active cell highlight.
// Companion to PositionPresets.test.ts (pure math helper tests).

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionPresets } from "./PositionPresets.js";

// Canonical 3-cell map used by the subtitle position selector
const SUBTITLE_ANCHOR_MAP = {
  "center-bottom": "bottom-center",
  "center-top": "top-center",
  "center-center": "center-screen",
} as const;

describe("PositionPresets — enum mode", () => {
  it("enum mode: clicking the center-bottom cell emits bottom-center", () => {
    const onApplyAnchor = vi.fn();
    render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={onApplyAnchor}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Posición abajo-centro" }));
    expect(onApplyAnchor).toHaveBeenCalledWith("bottom-center");
    expect(onApplyAnchor).toHaveBeenCalledTimes(1);
  });

  it("enum mode: clicking the center-top cell emits top-center", () => {
    const onApplyAnchor = vi.fn();
    render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={onApplyAnchor}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Posición arriba-centro" }));
    expect(onApplyAnchor).toHaveBeenCalledWith("top-center");
  });

  it("enum mode: clicking the center-center cell emits center-screen", () => {
    const onApplyAnchor = vi.fn();
    render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={onApplyAnchor}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Posición centro" }));
    expect(onApplyAnchor).toHaveBeenCalledWith("center-screen");
  });

  it("enum mode: clicking a disabled cell (not in anchorToValue) does not emit", () => {
    const onApplyAnchor = vi.fn();
    render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={onApplyAnchor}
      />,
    );
    // left-top cell is not in anchorToValue → should be disabled
    const disabledButton = screen.getByRole("button", { name: "Posición arriba-izquierda" });
    expect((disabledButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(disabledButton);
    expect(onApplyAnchor).not.toHaveBeenCalled();
  });

  it("enum mode: exactly 6 cells are disabled when 3-cell subtitle map is used", () => {
    render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(9);
    const disabled = buttons.filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(6);
  });

  it("enum mode: activeAnchor highlights the matching enabled cell", () => {
    const { container } = render(
      <PositionPresets
        mode="enum"
        anchorToValue={SUBTITLE_ANCHOR_MAP}
        onApplyAnchor={vi.fn()}
        activeAnchor="bottom-center"
      />,
    );
    // The center-bottom button should have the accent border color applied via style
    const activeButton = screen.getByRole("button", { name: "Posición abajo-centro" });
    // Active cell uses var(--accent-strong, #6ba8e0) border — verify border style set
    expect(activeButton.style.border).toContain("var(--accent-strong");
    // Suppress unused variable warning for container
    void container;
  });
});
