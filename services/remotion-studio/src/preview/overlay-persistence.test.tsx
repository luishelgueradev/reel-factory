/**
 * overlay-persistence.test.tsx — Phase 27 overlay name + guide round-trip.
 *
 * Plan 27-03, Task 3 (TDD). Uses @testing-library/react + vitest + jsdom.
 *
 * Hydrating a saved config that contains a NAMED GUIDE overlay must preserve
 * name + isGuide through applyConfigToState (no field stripping). We render the
 * REAL OverlayEditor inside PreviewApp (only the heavy Player/SubtitledVideo/font
 * deps are mocked) and assert the guide chip + the name surface after the
 * /api/config load — only possible if the additive fields survived hydration
 * AND ride into liveOverlays (OVERLAY-01 preview + OVERLAY-04 persistence).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock only the heavy deps PreviewApp pulls in; keep OverlayEditor REAL.
vi.mock("@remotion/player", () => ({ Player: () => <div data-testid="mock-player" /> }));
vi.mock("../SubtitledVideo", () => ({ SubtitledVideo: () => <div /> }));
vi.mock("../fonts", () => ({
  loadFont: vi.fn().mockResolvedValue("Inter"),
  AVAILABLE_FONTS: ["Inter"],
  getFontFamilyCSS: (f: string) => f,
}));
vi.mock("../editor/components/LayoutSelector", () => ({ LayoutSelector: () => <div /> }));
vi.mock("../editor/components/StyleControls", () => ({ StyleControls: () => <div /> }));
vi.mock("../editor/components/TitleEditor", () => ({ TitleEditor: () => <div /> }));
vi.mock("./TextareaInput", () => ({ TextareaInput: () => <div /> }));
vi.mock("./textToCaptions", () => ({
  textToCaptionPages: () => [],
  deriveTotalDurationMs: () => 10000,
  DEFAULT_SAMPLE_TEXT: "Sample text",
}));

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("PreviewApp overlay persistence round-trip (OVERLAY-01/04)", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("preserves name + isGuide on a hydrated overlay (no stripping)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          subtitle: { layout: "tiktok" },
          overlays: [
            { imageData: PNG, x: 0, y: 0, displayWidth: 1080, name: "Zona segura 9:16", isGuide: true },
          ],
        }),
      })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    // Overlays tab is display:none until selected — click it so the card mounts.
    await waitFor(() => {
      const tab = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.trim() === "Overlays"
      );
      expect(tab).not.toBeUndefined();
    }, { timeout: 1500 });
    const overlaysTab = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.trim() === "Overlays"
    )!;
    fireEvent.click(overlaysTab);

    // name survived hydration → card label shows it; isGuide survived → guide chip shows.
    await waitFor(() => {
      expect(screen.queryByText("Zona segura 9:16")).not.toBeNull();
      expect(screen.queryByText("guía · no se renderiza")).not.toBeNull();
    }, { timeout: 1500 });
  });
});
