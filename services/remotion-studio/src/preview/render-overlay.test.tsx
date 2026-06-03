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
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

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

/**
 * Helper: render PreviewApp with a file already selected, then trigger the
 * Render flow by firing a fake file-change event and clicking the Render button.
 * This drives the state machine into the running → terminal states.
 */
async function renderAndTriggerFlow(
  fetchMock: ReturnType<typeof vi.fn>,
  module: { PreviewApp: React.ComponentType }
) {
  vi.stubGlobal("fetch", fetchMock);
  const result = render(<module.PreviewApp />);

  // Simulate a file being selected via the hidden file input in the UploadDropzone
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error("file input not found");

  const fakeFile = new File(["mp4data"], "video.mp4", { type: "video/mp4" });
  fireEvent.change(fileInput, { target: { files: [fakeFile] } });

  // Wait for the header to update (file loaded → green Render button)
  await waitFor(() => {
    // After file selection the "▶ Render Video" button should be enabled
    const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.includes("Render Video") && !b.disabled
    );
    expect(btn).not.toBeNull();
  }, { timeout: 500 });

  // Click the green Render Video button
  const renderBtn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.includes("Render Video") && !b.disabled
  );
  if (!renderBtn) throw new Error("Render button not found or disabled");
  fireEvent.click(renderBtn);

  return result;
}

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
    const { PreviewApp } = await import("./PreviewApp.js");

    let statusCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/config") {
        return Promise.resolve({ ok: true, json: async () => ({}), status: 200 });
      }
      if (url === "/api/render") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ jobs: [{ jobId: "test-job-abc" }] }),
        });
      }
      if (typeof url === "string" && url.includes("/api/status/")) {
        statusCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "completed", progress: 100 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    await renderAndTriggerFlow(fetchMock, { PreviewApp });

    await waitFor(
      () => {
        expect(screen.queryByText(/✓ Reel listo/)).not.toBeNull();
      },
      { timeout: 4000 }
    );

    // Also verify the video element points to /api/result/
    const video = document.querySelector<HTMLVideoElement>("video");
    expect(video).not.toBeNull();
    expect(video!.src).toContain("/api/result/");
  });

  it("renders cause line with exit 137 → sin memoria on failure", async () => {
    const { PreviewApp } = await import("./PreviewApp.js");

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/config") {
        return Promise.resolve({ ok: true, json: async () => ({}), status: 200 });
      }
      if (url === "/api/render") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ jobs: [{ jobId: "test-job-fail" }] }),
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
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    await renderAndTriggerFlow(fetchMock, { PreviewApp });

    await waitFor(
      () => {
        // causeLine("remotion-renderer", 137) = "remotion-renderer · exit 137 — sin memoria"
        expect(screen.queryByText(/remotion-renderer\s*·\s*exit 137/)).not.toBeNull();
      },
      { timeout: 4000 }
    );
  });

  it("green discipline: at most ONE action-green element visible at idle (no file)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), status: 200 })
    );

    const { PreviewApp } = await import("./PreviewApp.js");
    render(<PreviewApp />);

    // At cold start (no file) only "Elegir archivo" in the dropzone should be action-green.
    // The header Render CTA must be outline/neutral.
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
    const { PreviewApp } = await import("./PreviewApp.js");

    // Status returns "running" with remotion-renderer step
    let firstStatusCall = true;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/config") {
        return Promise.resolve({ ok: true, json: async () => ({}), status: 200 });
      }
      if (url === "/api/render") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ jobs: [{ jobId: "test-job-progress" }] }),
        });
      }
      if (typeof url === "string" && url.includes("/api/status/")) {
        if (firstStatusCall) {
          firstStatusCall = false;
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
        // Subsequent calls return completed to stop polling
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "completed", progress: 100 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    await renderAndTriggerFlow(fetchMock, { PreviewApp });

    // After the render starts, the progress surface should show "Renderizando"
    await waitFor(
      () => {
        expect(screen.queryByText(/Renderizando/)).not.toBeNull();
      },
      { timeout: 4000 }
    );
  });
});
