/**
 * metadata-panel.test.tsx — Phase 29 Plan 02 (META-05 / META-06)
 *
 * Tests the MetadataPanel against the batch /api/metadata/all contract and the
 * per-platform TAB strip (replacing the META-04 platform <select> dropdown).
 *
 * Uses vitest + @testing-library/react + mocked fetch (zero real network calls).
 *
 * Coverage:
 *  - jobId null → Generar disabled + muted hint
 *  - With jobId, Generar POSTs { jobId, tone } to /api/metadata/all (no platform)
 *  - Tab strip with 3 tabs (TikTok / Instagram Reels / YouTube Shorts)
 *  - Active (TikTok) tab shows its fields; switching to Instagram shows its fields
 *  - Switching tabs does NOT trigger a fetch
 *  - Partial failure: failed platform's tab shows an error, survivors render fields
 *  - Editing + copy still works per-tab
 *  - Tone stays a single select (exactly one combobox)
 *  - Error (all-failed) → inline error + Reintentar
 *  - Green discipline: no --action token in the panel
 *  - On mount restore via GET /api/metadata-all/:jobId
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MetadataPanel } from "./MetadataPanel.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_JOB_ID = "11111111-2222-3333-4444-555555555555";

const TIKTOK_RESULT = {
  title: "TikTok: edité mi reel en 30 segundos",
  description: "Te cuento el proceso de edición rápido.",
  hashtags: ["#reels", "#edicion", "#tiktok"],
};
const INSTAGRAM_RESULT = {
  title: "Instagram: el proceso completo de edición",
  description: "Edición paso a paso para tus Reels.",
  hashtags: ["#instagram", "#reels", "#tips", "#edicion"],
};
const YOUTUBE_RESULT = {
  title: "YouTube Shorts: cómo editar un reel",
  description: "Guía SEO para editar tu short.",
  hashtags: ["#shorts", "#youtube", "#edicion"],
};

const ALL_RESULTS = {
  results: {
    tiktok: TIKTOK_RESULT,
    instagram: INSTAGRAM_RESULT,
    youtube_shorts: YOUTUBE_RESULT,
  },
  _meta: { model: "big-cloud" },
};

// ─── Mock fetch helpers ───────────────────────────────────────────────────────

/** GET /api/metadata-all/:jobId → empty results (nothing persisted). */
function mockRestoreEmpty() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ results: {} }),
  });
}

/** GET restore returns persisted per-platform results. */
function mockRestoreFull(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

/**
 * First call = GET restore (empty), subsequent call = POST /api/metadata/all (200).
 */
function mockGenerateAllOk(data: unknown) {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls === 1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ results: {} }),
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => data,
    });
  });
}

/** First call = GET restore (empty), POST → non-2xx all-failed error. */
function mockGenerateAllError(errMsg: string) {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls === 1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ results: {} }),
      });
    }
    return Promise.resolve({
      ok: false,
      status: 503,
      json: async () => ({ error: errMsg }),
    });
  });
}

// ─── Test: jobId null → disabled + hint ──────────────────────────────────────

describe("MetadataPanel — jobId null", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders header 'Metadata de redes'", () => {
    render(<MetadataPanel jobId={null} />);
    expect(screen.getByText("Metadata de redes")).toBeTruthy();
  });

  it("renders the generate-all button disabled when jobId is null", () => {
    render(<MetadataPanel jobId={null} />);
    const btn = screen.getByRole("button", { name: /Generar metadata/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows muted hint when jobId is null", () => {
    render(<MetadataPanel jobId={null} />);
    expect(screen.getByText(/Generá un render para crear la metadata/i)).toBeTruthy();
  });

  it("does not call fetch when jobId is null", () => {
    const mockFn = vi.fn();
    vi.stubGlobal("fetch", mockFn);
    render(<MetadataPanel jobId={null} />);
    expect(mockFn).not.toHaveBeenCalled();
  });
});

// ─── Test: generate-all flow (META-05) ───────────────────────────────────────

describe("MetadataPanel — generate-all flow (META-05)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("calls GET /api/metadata-all/:jobId on mount with a jobId", async () => {
    const mockFn = mockRestoreEmpty();
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(
        `/api/metadata-all/${SAMPLE_JOB_ID}`,
        expect.objectContaining({ signal: expect.anything() })
      );
    });
  });

  it("enables the generate-all button when jobId is set", async () => {
    vi.stubGlobal("fetch", mockRestoreEmpty());
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Generar metadata/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("POSTs { jobId, tone } (no platform) to /api/metadata/all when Generar is clicked", async () => {
    const mockFn = mockGenerateAllOk(ALL_RESULTS);
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Generar metadata/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));

    await waitFor(() => {
      const postCall = mockFn.mock.calls.find(
        (c) => c[0] === "/api/metadata/all" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.jobId).toBe(SAMPLE_JOB_ID);
      expect(body.tone).toBe("cercano");
      expect(body.platform).toBeUndefined();
    });
  });

  it("shows a tab strip with TikTok / Instagram Reels / YouTube Shorts after generate-all", async () => {
    vi.stubGlobal("fetch", mockGenerateAllOk(ALL_RESULTS));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /TikTok/i })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /Instagram Reels/i })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /YouTube Shorts/i })).toBeTruthy();
    });
  });

  it("active (TikTok) tab shows TikTok's title/description after generate-all", async () => {
    vi.stubGlobal("fetch", mockGenerateAllOk(ALL_RESULTS));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(TIKTOK_RESULT.title);
    });
    const descInput = screen.getByRole("textbox", { name: /Descripción/i });
    expect((descInput as HTMLTextAreaElement).value).toBe(TIKTOK_RESULT.description);
  });

  it("shows Regenerar (todas) once results exist", async () => {
    vi.stubGlobal("fetch", mockGenerateAllOk(ALL_RESULTS));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Regenerar/i)).toBeTruthy();
    });
  });

  it("restores persisted per-platform results from GET /api/metadata-all/:jobId on mount", async () => {
    vi.stubGlobal("fetch", mockRestoreFull(ALL_RESULTS));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(TIKTOK_RESULT.title);
    });
  });
});

// ─── Test: tab switching (META-06) ───────────────────────────────────────────

describe("MetadataPanel — per-platform tabs (META-06)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function renderWithResults() {
    vi.stubGlobal("fetch", mockRestoreFull(ALL_RESULTS));
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Instagram Reels/i })).toBeTruthy();
    });
  }

  it("clicking the Instagram Reels tab shows Instagram's title/description", async () => {
    await renderWithResults();

    fireEvent.click(screen.getByRole("tab", { name: /Instagram Reels/i }));

    await waitFor(() => {
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(INSTAGRAM_RESULT.title);
    });
    const descInput = screen.getByRole("textbox", { name: /Descripción/i });
    expect((descInput as HTMLTextAreaElement).value).toBe(INSTAGRAM_RESULT.description);
  });

  it("switching tabs does NOT trigger a fetch", async () => {
    const mockFn = mockRestoreFull(ALL_RESULTS);
    vi.stubGlobal("fetch", mockFn);
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /YouTube Shorts/i })).toBeTruthy();
    });

    const callsBefore = mockFn.mock.calls.length;
    fireEvent.click(screen.getByRole("tab", { name: /YouTube Shorts/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFn.mock.calls.length).toBe(callsBefore);
  });

  it("edits to one platform's fields do not bleed into another", async () => {
    await renderWithResults();

    // Edit TikTok title
    const tiktokTitle = screen.getByRole("textbox", { name: /Título/i }) as HTMLInputElement;
    fireEvent.change(tiktokTitle, { target: { value: "EDITADO TIKTOK" } });
    expect(tiktokTitle.value).toBe("EDITADO TIKTOK");

    // Switch to Instagram — its title must be unchanged
    fireEvent.click(screen.getByRole("tab", { name: /Instagram Reels/i }));
    await waitFor(() => {
      const igTitle = screen.getByRole("textbox", { name: /Título/i }) as HTMLInputElement;
      expect(igTitle.value).toBe(INSTAGRAM_RESULT.title);
    });

    // Switch back to TikTok — edit is preserved
    fireEvent.click(screen.getByRole("tab", { name: /TikTok/i }));
    await waitFor(() => {
      const ttTitle = screen.getByRole("textbox", { name: /Título/i }) as HTMLInputElement;
      expect(ttTitle.value).toBe("EDITADO TIKTOK");
    });
  });

  it("exposes exactly one <select> (tone) — the platform dropdown is removed", async () => {
    await renderWithResults();
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBe(1);
    // The single remaining combobox is the Tono select
    expect(screen.getByRole("combobox", { name: /Tono/i })).toBeTruthy();
  });

  it("the active tab is marked aria-selected", async () => {
    await renderWithResults();
    const tiktokTab = screen.getByRole("tab", { name: /TikTok/i });
    expect(tiktokTab.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: /Instagram Reels/i }));
    await waitFor(() => {
      const igTab = screen.getByRole("tab", { name: /Instagram Reels/i });
      expect(igTab.getAttribute("aria-selected")).toBe("true");
    });
  });
});

// ─── Test: partial failure ───────────────────────────────────────────────────

describe("MetadataPanel — partial failure (META-05)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const PARTIAL = {
    results: {
      tiktok: TIKTOK_RESULT,
      youtube_shorts: YOUTUBE_RESULT,
    },
    errors: {
      instagram: "No se pudo validar la metadata",
    },
    _meta: { model: "big-cloud" },
  };

  it("failed platform's tab shows an error; surviving tabs render fields", async () => {
    vi.stubGlobal("fetch", mockGenerateAllOk(PARTIAL));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    // TikTok (active) renders its fields
    await waitFor(() => {
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(TIKTOK_RESULT.title);
    });

    // Switch to the failed Instagram tab — it shows the error, no fields
    fireEvent.click(screen.getByRole("tab", { name: /Instagram Reels/i }));
    await waitFor(() => {
      expect(screen.getByText(/No se pudo validar la metadata/i)).toBeTruthy();
    });
    expect(screen.queryByRole("textbox", { name: /Título/i })).toBeNull();
  });
});

// ─── Test: field editing + copy ──────────────────────────────────────────────

describe("MetadataPanel — field editing + copy", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function renderWithResults() {
    vi.stubGlobal("fetch", mockRestoreFull(ALL_RESULTS));
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Título/i })).toBeTruthy();
    });
  }

  it("editing the title input updates the field value", async () => {
    await renderWithResults();
    const titleInput = screen.getByRole("textbox", { name: /Título/i }) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Nuevo título editado" } });
    expect(titleInput.value).toBe("Nuevo título editado");
  });

  it("copy button for Título writes the active tab's title to clipboard", async () => {
    await renderWithResults();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Título/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TIKTOK_RESULT.title);
    });
  });

  it("copy button for Hashtags writes the active tab's hashtags to clipboard", async () => {
    await renderWithResults();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Hashtags/i }));
    await waitFor(() => {
      const callArg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callArg).toBe("string");
      expect(callArg).toContain("#reels");
    });
  });

  it("shows ✓ Copiado chip after copy", async () => {
    await renderWithResults();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Título/i }));
    await waitFor(() => {
      expect(screen.queryByText("✓ Copiado")).toBeTruthy();
    });
  });
});

// ─── Test: error state (all-failed) ──────────────────────────────────────────

describe("MetadataPanel — error state", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows inline error message on all-failed POST", async () => {
    vi.stubGlobal("fetch", mockGenerateAllError("router no configurado"));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText("router no configurado")).toBeTruthy();
    });
  });

  it("shows Reintentar button on error and returns to ready on click", async () => {
    vi.stubGlobal("fetch", mockGenerateAllError("Sin API key configurada"));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Reintentar/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Generar metadata/i })).toBeTruthy();
    });
  });
});

// ─── Test: green discipline — no --action token in the panel ─────────────────

describe("MetadataPanel — green discipline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rendered panel contains no --action token in inline styles (ready state)", () => {
    vi.stubGlobal("fetch", mockRestoreEmpty());
    const { container } = render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    const allElements = container.querySelectorAll("[style]");
    allElements.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toContain("--action");
    });
  });

  it("contains no --action token after generate-all (tabbed state)", async () => {
    vi.stubGlobal("fetch", mockGenerateAllOk(ALL_RESULTS));
    const { container } = render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /TikTok/i })).toBeTruthy();
    });

    const allElements = container.querySelectorAll("[style]");
    allElements.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toContain("--action");
    });
  });
});
