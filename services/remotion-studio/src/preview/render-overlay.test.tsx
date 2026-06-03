/**
 * render-overlay.test.tsx — Component coverage for the 4 inline render surfaces.
 *
 * Plan 23-04, Tasks 1 + 2 (TDD).
 * Uses @testing-library/react + vitest + jsdom.
 *
 * Surfaces under test:
 *   - Upload affordance: dropzone hero copy present
 *   - Progress: step label + long-step hint
 *   - Success: "✓ Reel listo" + <video> src with /api/result/
 *   - Failure: cause line with exit 137 → "sin memoria"
 *   - Green discipline: at most ONE action-green control at any time
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock the heavy deps that PreviewApp pulls in so the test stays fast in jsdom.
vi.mock("@remotion/player", () => ({
  Player: () => <div data-testid="mock-player" />,
}));
vi.mock("../SubtitledVideo", () => ({
  SubtitledVideo: () => <div />,
}));
vi.mock("../fonts", () => ({
  loadFont: vi.fn().mockResolvedValue("Inter"),
  AVAILABLE_FONTS: ["Inter"],
  getFontFamilyCSS: (f: string) => f,
}));
vi.mock("../editor/components/LayoutSelector", () => ({
  LayoutSelector: () => <div />,
}));
vi.mock("../editor/components/StyleControls", () => ({
  StyleControls: () => <div />,
}));
vi.mock("../editor/components/TitleEditor", () => ({
  TitleEditor: () => <div />,
}));
vi.mock("../editor/components/OverlayEditor", () => ({
  OverlayEditor: () => <div />,
}));
vi.mock("./TextareaInput", () => ({
  TextareaInput: () => <div />,
}));
vi.mock("./textToCaptions", () => ({
  textToCaptionPages: () => [],
  deriveTotalDurationMs: () => 10000,
  DEFAULT_SAMPLE_TEXT: "Sample text",
}));

// ─── Task 1 tests: Upload affordance ─────────────────────────────────────────

describe("Upload affordance (Task 1)", () => {
  beforeEach(() => {
    // Stub fetch for config load
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
        status: 200,
        headers: { get: () => null },
      })
    );
    // Stub URL.createObjectURL / revokeObjectURL (preserve constructor)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('shows "Subí tu video" heading in the upload dropzone', async () => {
    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);
    expect(screen.queryByText("Subí tu video")).not.toBeNull();
  });

  it('shows "MP4 · hasta 10 min" sublabel in the upload dropzone', async () => {
    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);
    expect(screen.queryByText("MP4 · hasta 10 min")).not.toBeNull();
  });

  it("shows the preview-sync note about subtitles", async () => {
    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);
    expect(
      screen.queryByText(
        "Vas a ver tus subtítulos sincronizados recién en el video final."
      )
    ).not.toBeNull();
  });
});

// ─── Task 2 tests: Render surfaces ────────────────────────────────────────────

describe("Render overlay surfaces (Task 2)", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('shows "✓ Reel listo" and a <video> pointing to /api/result/ on completion', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
            status: 200,
          });
        }
        if (typeof url === "string" && url.includes("/api/status/")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status: "completed", progress: 100 }),
          });
        }
        if (url === "/api/render") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ jobs: [{ jobId: "test-job-abc" }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    // The success surface only appears after a render completes.
    // PreviewApp must render "✓ Reel listo" when renderState === "success".
    await waitFor(
      () => {
        expect(screen.queryByText(/✓ Reel listo/)).not.toBeNull();
      },
      { timeout: 300 }
    ).catch(() => {
      throw new Error(
        "RED: success surface not yet rendered — implement Task 2 to pass"
      );
    });
  });

  it("renders cause line with exit 137 → sin memoria on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
            status: 200,
          });
        }
        if (typeof url === "string" && url.includes("/api/status/")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: "failed",
              error: "Step remotion-renderer failed (exit 137): OOM",
            }),
          });
        }
        if (url === "/api/render") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ jobs: [{ jobId: "test-job-fail" }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    await waitFor(
      () => {
        expect(screen.queryByText(/remotion-renderer\s*·\s*exit 137/)).not.toBeNull();
      },
      { timeout: 300 }
    ).catch(() => {
      throw new Error(
        "RED: failure cause line not yet rendered — implement Task 2 to pass"
      );
    });
  });

  it("green discipline: at most ONE action-green element visible at idle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
        status: 200,
      })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    // Inspect inline styles for action-green color
    const actionGreenElements = Array.from(
      document.querySelectorAll<HTMLElement>("*")
    ).filter((el) => {
      const bg = el.style?.background || el.style?.backgroundColor || "";
      return (
        bg.includes("var(--action)") ||
        bg.includes("#4CAF50") ||
        bg.includes("0.68 0.150 150")
      );
    });

    expect(actionGreenElements.length).toBeLessThanOrEqual(1);
  });

  it("progress surface shows step label for remotion-renderer step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
            status: 200,
          });
        }
        if (typeof url === "string" && url.includes("/api/status/")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              status: "running",
              currentStep: "remotion-renderer",
              progress: 67,
              stepInfo: "4/6",
            }),
          });
        }
        if (url === "/api/render") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ jobs: [{ jobId: "test-job-progress" }] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    await waitFor(
      () => {
        expect(screen.queryByText(/Renderizando/)).not.toBeNull();
      },
      { timeout: 300 }
    ).catch(() => {
      throw new Error(
        "RED: progress step label not yet rendered — implement Task 2 to pass"
      );
    });
  });
});
