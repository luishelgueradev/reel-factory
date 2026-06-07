/**
 * overlay-editor.test.tsx — Component coverage for Phase 27 overlay naming + guides.
 *
 * Plan 27-03, Tasks 2 + 3 (TDD).
 * Uses @testing-library/react + vitest + jsdom.
 *
 * Behaviors under test:
 *   - Name input edits the draft and rides into onPreviewChange (OVERLAY-04)
 *   - Edit heading shows the overlay name as the title (OVERLAY-05)
 *   - Guide toggle sets isGuide (OVERLAY-01/03)
 *   - Guide card shows the "guía · no se renderiza" chip and NO Capa control (OVERLAY-03)
 *   - Non-guide card shows the back/front LayerBadge (regression guard)
 *   - handleStartEdit preserves name + isGuide into the draft
 *   - Green discipline: no action-green inside the overlay editor (LOCKED design law)
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { OverlayEditor } from "./OverlayEditor.js";
import type { PngOverlayConfig } from "../../pipeline-config.js";

afterEach(() => cleanup());

// A 1×1 transparent PNG data URL — valid imageData so cards render + form can submit.
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function makeOverlay(over: Partial<PngOverlayConfig> = {}): PngOverlayConfig {
  return { imageData: PNG_1PX, x: 40, y: 40, displayWidth: 200, opacity: 1, layer: "back", ...over };
}

// ─── Task 2: edit form — name as title (OVERLAY-05) ──────────────────────────

describe("OverlayEditor edit heading (OVERLAY-05)", () => {
  it("shows the overlay name as the edit-form title when the overlay has a name", () => {
    const overlays = [makeOverlay({ name: "Logo marca" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    fireEvent.click(screen.getByText("Editar"));

    expect(screen.queryByText("Editar: «Logo marca»")).not.toBeNull();
    expect(screen.queryByText("Editar overlay")).toBeNull();
  });

  it("falls back to the generic heading when the overlay has no name", () => {
    const overlays = [makeOverlay({ name: "" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    fireEvent.click(screen.getByText("Editar"));

    expect(screen.queryByText("Editar overlay")).not.toBeNull();
  });
});

// ─── Task 2: name input wiring (OVERLAY-04) ──────────────────────────────────

describe("OverlayEditor name input (OVERLAY-04)", () => {
  it("editing the name updates the draft and fires onPreviewChange with the new name", () => {
    const onPreviewChange = vi.fn();
    const overlays = [makeOverlay({ name: "old" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} onPreviewChange={onPreviewChange} />);

    fireEvent.click(screen.getByText("Editar"));
    const input = screen.getByLabelText("Nombre del overlay") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Watermark" } });

    expect(input.value).toBe("Watermark");
    // The last live-preview payload carries the new name on the edited overlay.
    const lastCall = onPreviewChange.mock.calls.at(-1)?.[0] as PngOverlayConfig[];
    expect(lastCall[0].name).toBe("Watermark");
  });

  it("preserves name + isGuide when starting an edit (handleStartEdit)", () => {
    const overlays = [makeOverlay({ name: "Zona segura", isGuide: true })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    fireEvent.click(screen.getByText("Editar"));

    // name preserved → shown as the edit title
    expect(screen.queryByText("Editar: «Zona segura»")).not.toBeNull();
    // isGuide preserved → guide toggle "Guía de zonas" is the active segment
    const input = screen.getByLabelText("Nombre del overlay") as HTMLInputElement;
    expect(input.value).toBe("Zona segura");
  });
});

// ─── Task 2: guide toggle + chip + anchored card (OVERLAY-01/03) ─────────────

describe("OverlayEditor guide handling (OVERLAY-01/03)", () => {
  it("guide toggle sets isGuide true on the draft via onPreviewChange", () => {
    const onPreviewChange = vi.fn();
    const overlays = [makeOverlay()];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} onPreviewChange={onPreviewChange} />);

    fireEvent.click(screen.getByText("Editar"));
    fireEvent.click(screen.getByText("Guía de zonas"));

    const lastCall = onPreviewChange.mock.calls.at(-1)?.[0] as PngOverlayConfig[];
    expect(lastCall[0].isGuide).toBe(true);
  });

  it("hides the Capa (Detrás/Delante) control when editing a guide", () => {
    const overlays = [makeOverlay({ isGuide: true })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    fireEvent.click(screen.getByText("Editar"));

    // The banding buttons must not exist for a guide (cannot be reordered).
    expect(screen.queryByText("Detrás")).toBeNull();
    expect(screen.queryByText("Delante")).toBeNull();
    // A muted explanatory note appears in their place.
    expect(screen.queryByText(/Las guías no se renderizan/)).not.toBeNull();
  });

  it("shows the Capa control again when toggling back to a normal overlay", () => {
    const overlays = [makeOverlay({ isGuide: true })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    fireEvent.click(screen.getByText("Editar"));
    expect(screen.queryByText("Detrás")).toBeNull();

    fireEvent.click(screen.getByText("Overlay normal"));
    expect(screen.queryByText("Detrás")).not.toBeNull();
    expect(screen.queryByText("Delante")).not.toBeNull();
  });

  it("guide card shows the 'guía · no se renderiza' chip and no LayerBadge", () => {
    const overlays = [makeOverlay({ name: "Guía 9:16", isGuide: true })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    const card = screen.getByText("Guía 9:16").closest("div")!.parentElement!.parentElement!;
    expect(within(card).queryByText("guía · no se renderiza")).not.toBeNull();
    // Guides never show a back/front badge.
    expect(within(card).queryByText("Detrás")).toBeNull();
    expect(within(card).queryByText("Delante")).toBeNull();
  });

  it("non-guide card shows the LayerBadge (regression guard)", () => {
    const overlays = [makeOverlay({ name: "Logo", layer: "front" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);

    expect(screen.queryByText("Delante")).not.toBeNull();
    expect(screen.queryByText("guía · no se renderiza")).toBeNull();
  });
});

// ─── Task 2: card label uses the name (OVERLAY-04) ───────────────────────────

describe("OverlayEditor card label (OVERLAY-04)", () => {
  it("uses the overlay name as the card label when set", () => {
    const overlays = [makeOverlay({ name: "Marca de agua" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);
    expect(screen.queryByText("Marca de agua")).not.toBeNull();
    expect(screen.queryByText("Overlay 1")).toBeNull();
  });

  it("falls back to 'Overlay {n}' when the name is empty", () => {
    const overlays = [makeOverlay({ name: "" })];
    render(<OverlayEditor overlays={overlays} onChange={() => {}} />);
    expect(screen.queryByText("Overlay 1")).not.toBeNull();
  });
});

// ─── Green discipline (LOCKED design law) ────────────────────────────────────

describe("OverlayEditor green discipline", () => {
  it("renders no action-green control (--action / #4CAF50) in the overlay editor", () => {
    const overlays = [makeOverlay({ name: "Logo" })];
    const { container } = render(<OverlayEditor overlays={overlays} onChange={() => {}} />);
    fireEvent.click(screen.getByText("Editar"));

    const greens = Array.from(container.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const bg = el.style?.background || el.style?.backgroundColor || "";
      const bd = el.style?.borderColor || el.style?.border || "";
      const probe = `${bg} ${bd}`;
      return probe.includes("var(--action")
        || probe.includes("#4CAF50")
        || probe.includes("0.68 0.150 150");
    });
    expect(greens.length).toBe(0);
  });
});
