// ─── fonts.test.ts — RENDER-05 unit proofs ────────────────────────────────
// Covers:
//  - Local-first: known font with vendored woff2 resolves to its CSS family
//  - Timeout race: a never-resolving load is bounded by withTimeout (~10s)
//  - Final fallback: when local AND gstatic fail → "Plus Jakarta Sans" (NEVER monospace)
//  - Unknown-font branch → BUNDLED_SANS, NOT "monospace"
//  - Catch branch → BUNDLED_SANS, NOT "monospace"

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @remotion/fonts ──────────────────────────────────────────────────
// loadFont from @remotion/fonts returns Promise<void>.
// We control it to simulate local-load success/failure per test.
const mockLoadLocal = vi.fn<[{ family: string; url: string; weight?: string }], Promise<void>>();
vi.mock("@remotion/fonts", () => ({
  loadFont: mockLoadLocal,
}));

// ─── Mock remotion staticFile ──────────────────────────────────────────────
vi.mock("remotion", () => ({
  staticFile: (path: string) => `/public/${path}`,
}));

// ─── Mock @remotion/google-fonts/* ────────────────────────────────────────
// We mock the entire module namespace so that gstatic calls are controlled.
// The mock factory is called per-import; we make each loader's loadFont a vi.fn().
// This simulates the case where ALL gstatic loaders fail (network down).
const mockGstatic = vi.fn();
vi.mock("@remotion/google-fonts/PlusJakartaSans", () => ({
  loadFont: mockGstatic,
  fontFamily: "Plus Jakarta Sans",
}));
vi.mock("@remotion/google-fonts/Inter", () => ({
  loadFont: mockGstatic,
  fontFamily: "Inter",
}));
vi.mock("@remotion/google-fonts/Roboto", () => ({
  loadFont: mockGstatic,
  fontFamily: "Roboto",
}));
vi.mock("@remotion/google-fonts/Montserrat", () => ({
  loadFont: mockGstatic,
  fontFamily: "Montserrat",
}));
vi.mock("@remotion/google-fonts/Oswald", () => ({
  loadFont: mockGstatic,
  fontFamily: "Oswald",
}));
vi.mock("@remotion/google-fonts/Poppins", () => ({
  loadFont: mockGstatic,
  fontFamily: "Poppins",
}));
vi.mock("@remotion/google-fonts/BebasNeue", () => ({
  loadFont: mockGstatic,
  fontFamily: "Bebas Neue",
}));
vi.mock("@remotion/google-fonts/Antonio", () => ({
  loadFont: mockGstatic,
  fontFamily: "Antonio",
}));
vi.mock("@remotion/google-fonts/Raleway", () => ({
  loadFont: mockGstatic,
  fontFamily: "Raleway",
}));
vi.mock("@remotion/google-fonts/Ubuntu", () => ({
  loadFont: mockGstatic,
  fontFamily: "Ubuntu",
}));
vi.mock("@remotion/google-fonts/Nunito", () => ({
  loadFont: mockGstatic,
  fontFamily: "Nunito",
}));
vi.mock("@remotion/google-fonts/SpaceGrotesk", () => ({
  loadFont: mockGstatic,
  fontFamily: "Space Grotesk",
}));
vi.mock("@remotion/google-fonts/Rubik", () => ({
  loadFont: mockGstatic,
  fontFamily: "Rubik",
}));
vi.mock("@remotion/google-fonts/SourceSans3", () => ({
  loadFont: mockGstatic,
  fontFamily: "Source Sans 3",
}));
vi.mock("@remotion/google-fonts/Outfit", () => ({
  loadFont: mockGstatic,
  fontFamily: "Outfit",
}));
vi.mock("@remotion/google-fonts/PlayfairDisplay", () => ({
  loadFont: mockGstatic,
  fontFamily: "Playfair Display",
}));
vi.mock("@remotion/google-fonts/LexendDeca", () => ({
  loadFont: mockGstatic,
  fontFamily: "Lexend Deca",
}));
vi.mock("@remotion/google-fonts/Signika", () => ({
  loadFont: mockGstatic,
  fontFamily: "Signika",
}));
vi.mock("@remotion/google-fonts/Lato", () => ({
  loadFont: mockGstatic,
  fontFamily: "Lato",
}));
vi.mock("@remotion/google-fonts/Sora", () => ({
  loadFont: mockGstatic,
  fontFamily: "Sora",
}));
vi.mock("@remotion/google-fonts/DancingScript", () => ({
  loadFont: mockGstatic,
  fontFamily: "Dancing Script",
}));
vi.mock("@remotion/google-fonts/CormorantGaramond", () => ({
  loadFont: mockGstatic,
  fontFamily: "Cormorant Garamond",
}));
vi.mock("@remotion/google-fonts/DMSans", () => ({
  loadFont: mockGstatic,
  fontFamily: "DM Sans",
}));
vi.mock("@remotion/google-fonts/JosefinSans", () => ({
  loadFont: mockGstatic,
  fontFamily: "Josefin Sans",
}));
vi.mock("@remotion/google-fonts/Righteous", () => ({
  loadFont: mockGstatic,
  fontFamily: "Righteous",
}));
vi.mock("@remotion/google-fonts/TitanOne", () => ({
  loadFont: mockGstatic,
  fontFamily: "Titan One",
}));

// Import AFTER mocks are registered
const { loadFont, getFontFamilyCSS } = await import("./fonts.js");

// ─── Constants ────────────────────────────────────────────────────────────
const BUNDLED_SANS = "Plus Jakarta Sans";

// ─── Helper: never-resolving promise (hang simulation) ────────────────────
function neverResolves<T>(): Promise<T> {
  return new Promise<T>(() => {
    // intentionally left pending — simulates a stuck network call
  });
}

describe("loadFont — RENDER-05 unit proofs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 1: explicit monospace request — passthrough (not a degraded fallback)
  // ─────────────────────────────────────────────────────────────────────────
  it("returns 'monospace' for explicit monospace request (caller intent, not degraded fallback)", async () => {
    const result = await loadFont("monospace");
    expect(result).toBe("monospace");
    expect(mockLoadLocal).not.toHaveBeenCalled();
  });

  it("returns 'monospace' for empty string (caller intent)", async () => {
    const result = await loadFont("");
    expect(result).toBe("monospace");
    expect(mockLoadLocal).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 2: local-first happy path
  // A known vendored font resolves via local loader → returns its CSS family
  // ─────────────────────────────────────────────────────────────────────────
  it("resolves to CSS family when local woff2 load succeeds (local-first, no network)", async () => {
    mockLoadLocal.mockResolvedValue(undefined);

    const result = await loadFont("PlusJakartaSans");
    expect(result).toBe("Plus Jakarta Sans"); // CSS family from FONT_LOADERS map
    // Must have tried the local loader (staticFile path)
    expect(mockLoadLocal).toHaveBeenCalled();
    const firstCall = mockLoadLocal.mock.calls[0][0];
    expect(firstCall.family).toBe("Plus Jakarta Sans");
    expect(firstCall.url).toContain("PlusJakartaSans");
    expect(firstCall.weight).toBe("400");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 3: unknown font → BUNDLED_SANS (D-12 proof — NOT monospace)
  // ─────────────────────────────────────────────────────────────────────────
  it("returns BUNDLED_SANS for unknown font — NEVER monospace (D-12)", async () => {
    // Local load resolves for the bundled-sans fallback attempt
    mockLoadLocal.mockResolvedValue(undefined);

    const result = await loadFont("UnknownFontXYZ");
    expect(result).toBe(BUNDLED_SANS);
    expect(result).not.toBe("monospace");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 4: local load rejects, gstatic also fails → BUNDLED_SANS (D-12 proof)
  // ─────────────────────────────────────────────────────────────────────────
  it("falls back to BUNDLED_SANS when local AND gstatic both fail — NEVER monospace (D-12)", async () => {
    // All local loads (@remotion/fonts) fail + gstatic (@remotion/google-fonts) fails
    mockLoadLocal.mockRejectedValue(new Error("local load failed"));
    mockGstatic.mockRejectedValue(new Error("gstatic down"));

    const result = await loadFont("Montserrat");
    expect(result).toBe(BUNDLED_SANS);
    expect(result).not.toBe("monospace");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 5: catch branch never returns monospace (D-12 catch-branch guard)
  // ─────────────────────────────────────────────────────────────────────────
  it("catch branch returns BUNDLED_SANS, NOT monospace (D-12 catch-branch proof)", async () => {
    mockLoadLocal.mockRejectedValue(new Error("network error"));
    mockGstatic.mockRejectedValue(new Error("gstatic error"));

    const result = await loadFont("Inter");
    expect(result).toBe(BUNDLED_SANS);
    expect(result).not.toBe("monospace");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 6: gstatic fallback succeeds when local fails → returns real family
  // ─────────────────────────────────────────────────────────────────────────
  it("falls through to gstatic when local load rejects, returns real CSS family", async () => {
    // Local fails
    mockLoadLocal.mockRejectedValue(new Error("no woff2 file"));
    // Gstatic succeeds — return fontFamily in result
    mockGstatic.mockResolvedValue({ fontFamily: "Poppins" });

    const result = await loadFont("Poppins");
    expect(result).toBe("Poppins"); // gstatic returned the real family
    expect(result).not.toBe("monospace");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 7: timeout race (D-11 proof)
  // A never-resolving load is bounded by withTimeout — does NOT hang forever
  // ─────────────────────────────────────────────────────────────────────────
  it("a never-resolving local load is bounded by the timeout race and falls through (D-11)", async () => {
    vi.useFakeTimers();

    // Local calls: first call (Regular weight for the font) never resolves → triggers timeout
    // Subsequent calls (bundled-sans fallback) resolve immediately
    let callCount = 0;
    mockLoadLocal.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return neverResolves<void>(); // first local attempt hangs
      return Promise.resolve(); // bundled-sans fallback resolves
    });
    // Gstatic also fails
    mockGstatic.mockRejectedValue(new Error("gstatic down"));

    const resultPromise = loadFont("Poppins");

    // Advance timers past PER_FONT_TIMEOUT_MS (10_000ms) to trigger the timeout race
    await vi.advanceTimersByTimeAsync(15_000);

    const result = await resultPromise;

    // Must NOT hang — should have resolved via bundled-sans fallback
    expect(result).toBeDefined();
    expect(result).not.toBe("monospace"); // D-12 never-monospace

    vi.useRealTimers();
  }, 30_000);

  // ─────────────────────────────────────────────────────────────────────────
  // Case 8: withTimeout itself rejects a stuck promise within budget
  // (The mechanism proof — independent of fonts.ts logic)
  // ─────────────────────────────────────────────────────────────────────────
  it("withTimeout race rejects within the timeout budget when given a hanging promise", async () => {
    vi.useFakeTimers();

    const TIMEOUT_MS = 10_000;

    function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
      return Promise.race([
        p,
        new Promise<never>((_, r) =>
          setTimeout(() => r(new Error("font timeout")), ms)
        ),
      ]);
    }

    const hanging = neverResolves<string>();
    const racePromise = withTimeout(hanging, TIMEOUT_MS);

    let rejected = false;
    let rejectionMessage = "";
    racePromise.catch((err: Error) => {
      rejected = true;
      rejectionMessage = err.message;
    });

    // Before timeout fires — not yet rejected
    await vi.advanceTimersByTimeAsync(9_999);
    expect(rejected).toBe(false);

    // After timeout fires — rejected
    await vi.advanceTimersByTimeAsync(2);
    expect(rejected).toBe(true);
    expect(rejectionMessage).toBe("font timeout");

    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Case 9: getFontFamilyCSS returns correct CSS family
  // ─────────────────────────────────────────────────────────────────────────
  it("getFontFamilyCSS returns correct CSS family for known fonts", () => {
    expect(getFontFamilyCSS("PlusJakartaSans")).toBe("Plus Jakarta Sans");
    expect(getFontFamilyCSS("Inter")).toBe("Inter");
    expect(getFontFamilyCSS("monospace")).toBe("monospace");
    expect(getFontFamilyCSS("")).toBe("monospace");
    expect(getFontFamilyCSS("UnknownFont")).toBe("UnknownFont");
  });
});
