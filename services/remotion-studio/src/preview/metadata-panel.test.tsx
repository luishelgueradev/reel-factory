/**
 * metadata-panel.test.tsx — Phase 25 Plan 03, Task 1
 *
 * Tests the MetadataPanel component against the 25-02 API contract.
 * Uses vitest + @testing-library/react + mocked fetch (zero real network calls).
 *
 * Coverage:
 *  - jobId null → Generar disabled + muted hint (D-02)
 *  - With jobId, Generar POSTs {jobId,platform,tone} and renders title/description/hashtags (META-01/02)
 *  - Changing platform/tone then Regenerar re-POSTs; no auto-call on select change (META-04)
 *  - Editing a field updates it; copy button writes that field to clipboard (META-03)
 *  - Error response → inline error + Reintentar
 *  - Green discipline: no --action token in the panel
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MetadataPanel } from "./MetadataPanel.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_JOB_ID = "11111111-2222-3333-4444-555555555555";

const SAMPLE_RESULT = {
  title: "Cómo edité mi reel en 30 segundos",
  description: "Te cuento el proceso completo de edición paso a paso.",
  hashtags: ["#reels", "#edicion", "#tips"],
  _meta: { model: "big-cloud" },
};

// ─── Mock fetch helper ────────────────────────────────────────────────────────

function mockFetch404() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: "No hay metadata" }),
  });
}

function mockFetchGetOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockFetchPostOk(data: unknown) {
  // First call = GET (404), subsequent call = POST (200)
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls === 1) {
      // GET /api/metadata/:jobId → 404 (no persisted result)
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: "no result" }),
      });
    }
    // POST /api/metadata → 200 with result
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => data,
    });
  });
}

function mockFetchPostError(errMsg: string) {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls === 1) {
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: "no result" }),
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

  it("renders Generar metadata button disabled when jobId is null", () => {
    render(<MetadataPanel jobId={null} />);
    const btn = screen.getByRole("button", { name: /Generar metadata/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows muted hint 'Generá un render para crear la metadata' when jobId is null", () => {
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

// ─── Test: with jobId, Generar POSTs and renders fields (META-01/02) ─────────

describe("MetadataPanel — generate flow (META-01, META-02)", () => {
  beforeEach(() => {
    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("calls GET /api/metadata/:jobId on mount with a jobId", async () => {
    const mockFn = mockFetch404();
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith(
        `/api/metadata/${SAMPLE_JOB_ID}`,
        expect.objectContaining({ signal: expect.anything() })
      );
    });
  });

  it("enables Generar button when jobId is set", async () => {
    vi.stubGlobal("fetch", mockFetch404());
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Generar metadata/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("POSTs { jobId, platform, tone } when Generar is clicked", async () => {
    const mockFn = mockFetchPostOk(SAMPLE_RESULT);
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    // Wait for GET to resolve (404 → ready state)
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Generar metadata/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    // Click Generar
    fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));

    await waitFor(() => {
      // POST should have been called
      const calls = mockFn.mock.calls;
      const postCall = calls.find(
        (c) => c[0] === "/api/metadata" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(postCall).toBeTruthy();

      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.jobId).toBe(SAMPLE_JOB_ID);
      expect(body.platform).toBe("tiktok");
      expect(body.tone).toBe("cercano");
    });
  });

  it("populates title/description/hashtags after successful POST (META-02)", async () => {
    vi.stubGlobal("fetch", mockFetchPostOk(SAMPLE_RESULT));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /Generar metadata/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Generar metadata/i }));
    });

    await waitFor(() => {
      // Title input populated
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(SAMPLE_RESULT.title);
    });

    // Description populated
    const descInput = screen.getByRole("textbox", { name: /Descripción/i });
    expect((descInput as HTMLTextAreaElement).value).toBe(SAMPLE_RESULT.description);
  });

  it("shows Regenerar button (not Generar) once a result exists", async () => {
    vi.stubGlobal("fetch", mockFetchPostOk(SAMPLE_RESULT));

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

  it("restores a persisted result from GET /api/metadata/:jobId (D-05)", async () => {
    vi.stubGlobal("fetch", mockFetchGetOk(SAMPLE_RESULT));

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      const titleInput = screen.getByRole("textbox", { name: /Título/i });
      expect((titleInput as HTMLInputElement).value).toBe(SAMPLE_RESULT.title);
    });
  });
});

// ─── Test: platform/tone change → no auto-regenerate; Regenerar re-POSTs (META-04) ──

describe("MetadataPanel — platform/tone change (META-04)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does NOT auto-regenerate when platform selector changes", async () => {
    const mockFn = mockFetchPostOk(SAMPLE_RESULT);
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    // Wait for GET to resolve
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Plataforma/i })).toBeTruthy();
    });

    const callsBefore = mockFn.mock.calls.length;

    // Change platform
    fireEvent.change(screen.getByRole("combobox", { name: /Plataforma/i }), {
      target: { value: "instagram" },
    });

    // Wait a tick and confirm no new fetch calls
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFn.mock.calls.length).toBe(callsBefore);
  });

  it("does NOT auto-regenerate when tone selector changes", async () => {
    const mockFn = mockFetchPostOk(SAMPLE_RESULT);
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /Tono/i })).toBeTruthy();
    });

    const callsBefore = mockFn.mock.calls.length;

    fireEvent.change(screen.getByRole("combobox", { name: /Tono/i }), {
      target: { value: "profesional" },
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockFn.mock.calls.length).toBe(callsBefore);
  });

  it("re-POSTs with new platform when Regenerar is clicked after platform change", async () => {
    // First: mock GET returns persisted result
    let calls = 0;
    const mockFn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => SAMPLE_RESULT,
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ...SAMPLE_RESULT, title: "Nuevo título" }),
      });
    });
    vi.stubGlobal("fetch", mockFn);

    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    // Wait for persisted result to restore
    await waitFor(() => {
      expect(screen.queryByText(/Regenerar/i)).toBeTruthy();
    });

    // Change platform
    fireEvent.change(screen.getByRole("combobox", { name: /Plataforma/i }), {
      target: { value: "youtube_shorts" },
    });

    // Click Regenerar
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Regenerar/i }));
    });

    await waitFor(() => {
      const postCall = mockFn.mock.calls.find(
        (c) => c[0] === "/api/metadata" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.platform).toBe("youtube_shorts");
    });
  });
});

// ─── Test: editing a field updates it + copy (META-03) ───────────────────────

describe("MetadataPanel — field editing + copy (META-03)", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function renderWithResult() {
    vi.stubGlobal("fetch", mockFetchGetOk(SAMPLE_RESULT));
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Título/i })).toBeTruthy();
    });
  }

  it("editing the title input updates the field value", async () => {
    await renderWithResult();
    const titleInput = screen.getByRole("textbox", { name: /Título/i }) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Nuevo título editado" } });
    expect(titleInput.value).toBe("Nuevo título editado");
  });

  it("editing the description textarea updates the field value", async () => {
    await renderWithResult();
    const desc = screen.getByRole("textbox", { name: /Descripción/i }) as HTMLTextAreaElement;
    fireEvent.change(desc, { target: { value: "Nueva descripción" } });
    expect(desc.value).toBe("Nueva descripción");
  });

  it("copy button for Título writes the title to clipboard", async () => {
    await renderWithResult();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Título/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAMPLE_RESULT.title);
    });
  });

  it("copy button for Descripción writes the description to clipboard", async () => {
    await renderWithResult();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Descripción/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAMPLE_RESULT.description);
    });
  });

  it("copy button for Hashtags writes the hashtag text to clipboard", async () => {
    await renderWithResult();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Hashtags/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const callArg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callArg).toBe("string");
      expect(callArg).toContain("#reels");
    });
  });

  it("shows ✓ Copiado chip after copy", async () => {
    await renderWithResult();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Título/i }));
    await waitFor(() => {
      expect(screen.queryByText("✓ Copiado")).toBeTruthy();
    });
  });
});

// ─── Test: error state ────────────────────────────────────────────────────────

describe("MetadataPanel — error state", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows inline error message on POST failure", async () => {
    vi.stubGlobal("fetch", mockFetchPostError("router no configurado"));

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

  it("shows Reintentar button on error", async () => {
    vi.stubGlobal("fetch", mockFetchPostError("Sin API key configurada"));

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
  });

  it("clicking Reintentar goes back to ready state (Generar enabled)", async () => {
    vi.stubGlobal("fetch", mockFetchPostError("Error"));

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

describe("MetadataPanel — green discipline (D-10)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rendered panel contains no --action token in inline styles", () => {
    vi.stubGlobal("fetch", mockFetch404());
    const { container } = render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    // Walk all elements with style attributes and confirm --action is absent
    const allElements = container.querySelectorAll("[style]");
    allElements.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toContain("--action");
    });
  });

  it("Generar button does not use --action color", () => {
    vi.stubGlobal("fetch", mockFetch404());
    render(<MetadataPanel jobId={SAMPLE_JOB_ID} />);

    // The button must exist (we already test it's disabled when null / enabled when set)
    // Here just confirm no --action appears anywhere in the rendered tree
    const allElements = document.querySelectorAll("[style]");
    allElements.forEach((el) => {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toContain("--action");
    });
  });
});
