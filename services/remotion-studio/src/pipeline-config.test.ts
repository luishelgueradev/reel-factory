import { describe, it, expect } from "vitest";
import {
  validatePipelineConfig,
  splitOverlaysByLayer,
  partitionGuideOverlays,
  normalizeSubtitleLayout,
  DEFAULT_SUBTITLE_CONFIG,
} from "./pipeline-config";

// ─── Item 5: flash off by default (260607-uzv-03) ────────────────────────────
// The active-word highlight flash is disabled by default so the active word
// shows its activeColor immediately. The capability (duration>0 flashes) is
// preserved — only the default changes.
describe("DEFAULT_SUBTITLE_CONFIG — highlight flash off by default (item 5)", () => {
  it("defaults highlightDurationMs to 0 (no flash)", () => {
    expect(DEFAULT_SUBTITLE_CONFIG.highlightDurationMs).toBe(0);
  });
});

// ─── Phase 27 mirror-parity gate ─────────────────────────────────────────────
// pipeline-config.ts is a HAND-MAINTAINED mirror between studio and renderer
// (AGENTS.md). These tests guard the studio side of the name/isGuide field +
// partitionGuideOverlays / guide-aware splitOverlaysByLayer contract so the two
// files cannot silently drift. They intentionally mirror the renderer cases.

const VALID_OVERLAY = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

describe("validatePipelineConfig — overlay name (OVERLAY-04)", () => {
  it("accepts overlay with name as a string", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, name: "Mi logo" }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.includes("name"))).toHaveLength(0);
  });

  it("rejects overlay with name as a number", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, name: 123 }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e === "overlays[0].name must be a string")).toBe(true);
  });
});

describe("validatePipelineConfig — overlay isGuide (OVERLAY-01/02/03)", () => {
  it("accepts overlay with isGuide: true", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, isGuide: true }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.includes("isGuide"))).toHaveLength(0);
  });

  it("rejects overlay with isGuide as a string", () => {
    const config = {
      subtitle: { layout: "tiktok" },
      overlays: [{ ...VALID_OVERLAY, isGuide: "yes" }],
    };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e === "overlays[0].isGuide must be a boolean")).toBe(true);
  });

  it("existing overlay (no name, no isGuide) still validates — additive", () => {
    const config = { subtitle: { layout: "tiktok" }, overlays: [VALID_OVERLAY] };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("partitionGuideOverlays (OVERLAY-02)", () => {
  const BASE = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

  it("separates guide overlays from renderable overlays", () => {
    const guide = { ...BASE, isGuide: true, x: 1 };
    const renderable = { ...BASE, x: 2 };
    const result = partitionGuideOverlays([guide, renderable]);
    expect(result.guides).toHaveLength(1);
    expect(result.guides[0].x).toBe(1);
    expect(result.renderable).toHaveLength(1);
    expect(result.renderable[0].x).toBe(2);
  });

  it("treats undefined isGuide as renderable", () => {
    const result = partitionGuideOverlays([{ ...BASE }]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(1);
  });

  it("treats isGuide: false as renderable", () => {
    const result = partitionGuideOverlays([{ ...BASE, isGuide: false }]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(1);
  });

  it("empty input yields two empty arrays", () => {
    const result = partitionGuideOverlays([]);
    expect(result.guides).toHaveLength(0);
    expect(result.renderable).toHaveLength(0);
  });
});

describe("splitOverlaysByLayer — guide exclusion (OVERLAY-03)", () => {
  const BASE = { imageData: "data:image/png;base64,abc", x: 0, y: 0, displayWidth: 200 };

  it("excludes isGuide overlays from both bands", () => {
    const guide = { ...BASE, isGuide: true, x: 99 };
    const back = { ...BASE, layer: "back" as const, x: 1 };
    const front = { ...BASE, layer: "front" as const, x: 2 };
    const result = splitOverlaysByLayer([guide, back, front]);
    expect(result.back.some((o) => o.isGuide === true)).toBe(false);
    expect(result.front.some((o) => o.isGuide === true)).toBe(false);
    expect(result.back).toHaveLength(1);
    expect(result.front).toHaveLength(1);
  });

  it("excludes a guide even when it has layer: front (isGuide wins over layer)", () => {
    const guideFront = { ...BASE, isGuide: true, layer: "front" as const };
    const result = splitOverlaysByLayer([guideFront]);
    expect(result.back).toHaveLength(0);
    expect(result.front).toHaveLength(0);
  });

  it("non-guide back/front banding is unchanged", () => {
    const back = { ...BASE, layer: "back" as const };
    const implicitBack = { ...BASE };
    const front = { ...BASE, layer: "front" as const };
    const result = splitOverlaysByLayer([back, implicitBack, front]);
    expect(result.back).toHaveLength(2);
    expect(result.front).toHaveLength(1);
  });
});

// ─── Phase 28: wordBackground (SUB-01/02/03) validation ─────────────────────
// Per-word "fondo por palabra" bar background on the highlighted tiktok word.
// Optional, disabled by default — a config without wordBackground stays valid so
// existing renders are unchanged. Mirrors the renderer cases (hand-maintained
// mirror, AGENTS.md cp sync — both files must assert the same contract).

const VALID_WORD_BG = { enabled: true, color: "#000000", opacity: 0.6, borderRadius: 8, padding: 6 };

// ─── Title box backgroundWidth + backgroundGradient (TITLE-WIDTH-01 / TITLE-GRADIENT-01) ──
// Both fields are OPTIONAL and additive: a title style without them stays valid so
// existing titles render identically (default 80% flat backgroundColor). Mirrors the
// renderer cases (hand-maintained mirror, AGENTS.md cp sync — both files assert the same contract).

const titleWith = (style: Record<string, unknown>) => ({
  subtitle: { layout: "tiktok" },
  titles: [{ text: "Hi", startTimeMs: 0, durationMs: 1000, style }],
});

describe("validatePipelineConfig — title backgroundWidth (TITLE-WIDTH-01)", () => {
  it("accepts backgroundWidth: 60 (number within 0–100)", () => {
    expect(validatePipelineConfig(titleWith({ backgroundWidth: 60 })).valid).toBe(true);
  });

  it("accepts backgroundWidth at the 0 and 100 bounds", () => {
    expect(validatePipelineConfig(titleWith({ backgroundWidth: 0 })).valid).toBe(true);
    expect(validatePipelineConfig(titleWith({ backgroundWidth: 100 })).valid).toBe(true);
  });

  it("is valid when backgroundWidth is absent (back-compat, defaults to 80)", () => {
    expect(validatePipelineConfig(titleWith({})).valid).toBe(true);
  });

  it("rejects a non-number backgroundWidth", () => {
    const result = validatePipelineConfig(titleWith({ backgroundWidth: "80" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("style.backgroundWidth"))).toBe(true);
  });

  it("rejects backgroundWidth out of the 0–100 range", () => {
    expect(validatePipelineConfig(titleWith({ backgroundWidth: -1 })).valid).toBe(false);
    expect(validatePipelineConfig(titleWith({ backgroundWidth: 101 })).valid).toBe(false);
  });
});

describe("validatePipelineConfig — title backgroundGradient (TITLE-GRADIENT-01)", () => {
  const VALID_GRADIENT = { enabled: true, fromColor: "#112233", toColor: "#445566" };

  it("accepts a valid backgroundGradient", () => {
    expect(validatePipelineConfig(titleWith({ backgroundGradient: VALID_GRADIENT })).valid).toBe(true);
  });

  it("is valid when backgroundGradient is absent (back-compat, flat color)", () => {
    expect(validatePipelineConfig(titleWith({})).valid).toBe(true);
  });

  it("rejects a non-object backgroundGradient", () => {
    const result = validatePipelineConfig(titleWith({ backgroundGradient: "nope" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("style.backgroundGradient must be an object"))).toBe(true);
  });

  it("rejects a non-boolean enabled", () => {
    const result = validatePipelineConfig(
      titleWith({ backgroundGradient: { ...VALID_GRADIENT, enabled: "yes" } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("backgroundGradient.enabled must be a boolean"))).toBe(true);
  });

  it("rejects a non-hex fromColor", () => {
    const result = validatePipelineConfig(
      titleWith({ backgroundGradient: { ...VALID_GRADIENT, fromColor: "red" } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("backgroundGradient.fromColor"))).toBe(true);
  });

  it("rejects a non-hex toColor", () => {
    const result = validatePipelineConfig(
      titleWith({ backgroundGradient: { ...VALID_GRADIENT, toColor: "#fff" } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("backgroundGradient.toColor"))).toBe(true);
  });

  // quick 260607-uzv item 3: gradient target selector (box | text | both)
  it("accepts target box / text / both", () => {
    for (const target of ["box", "text", "both"] as const) {
      expect(validatePipelineConfig(titleWith({ backgroundGradient: { ...VALID_GRADIENT, target } })).valid).toBe(true);
    }
  });

  it("is valid when target is absent (back-compat, defaults to box)", () => {
    expect(validatePipelineConfig(titleWith({ backgroundGradient: VALID_GRADIENT })).valid).toBe(true);
  });

  it("rejects an unknown target", () => {
    const result = validatePipelineConfig(
      titleWith({ backgroundGradient: { ...VALID_GRADIENT, target: "glyph" } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("backgroundGradient.target"))).toBe(true);
  });
});

describe("validatePipelineConfig — wordBackground (SUB-01/02)", () => {
  it("accepts a valid wordBackground", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: VALID_WORD_BG } };
    expect(validatePipelineConfig(config).valid).toBe(true);
  });

  it("is valid when wordBackground is absent (optional, default disabled)", () => {
    const config = { subtitle: { layout: "tiktok" } };
    expect(validatePipelineConfig(config).valid).toBe(true);
  });

  it("rejects non-object wordBackground", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: "nope" } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("subtitle.wordBackground must be an object");
  });

  it("rejects non-boolean enabled", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, enabled: "yes" } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("wordBackground.enabled must be a boolean"))).toBe(true);
  });

  it("rejects non-string color", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, color: 123 } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("wordBackground.color must be a string"))).toBe(true);
  });

  it("rejects opacity above 1", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, opacity: 1.5 } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("subtitle.wordBackground.opacity must be a number between 0 and 1");
  });

  it("rejects opacity below 0", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, opacity: -0.1 } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("subtitle.wordBackground.opacity must be a number between 0 and 1");
  });

  it("rejects negative borderRadius", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, borderRadius: -1 } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("subtitle.wordBackground.borderRadius must be a non-negative number");
  });

  it("rejects negative padding", () => {
    const config = { subtitle: { layout: "tiktok", wordBackground: { ...VALID_WORD_BG, padding: -1 } } };
    const result = validatePipelineConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("subtitle.wordBackground.padding must be a non-negative number");
  });
});

// ─── Phase 28 SUB-04: karaoke layout removal + migration safety ───────────────
// Karaoke is fully removed (not legacy-hidden). The union/validator accept only
// tiktok/sentence/bar. A stored layout:"karaoke" must NOT validate, but must be
// coerced to "tiktok" on load (normalizeSubtitleLayout) so no profile is unloadable.

describe("SubtitleLayoutMode — karaoke removed (SUB-04)", () => {
  it("accepts the 3 remaining layout modes: tiktok, sentence, bar", () => {
    for (const layout of ["tiktok", "sentence", "bar"]) {
      const result = validatePipelineConfig({ subtitle: { layout } });
      expect(result.valid, `layout "${layout}" should be valid`).toBe(true);
    }
  });

  it("rejects layout:'karaoke' as no longer a valid mode", () => {
    const result = validatePipelineConfig({ subtitle: { layout: "karaoke" } });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("tiktok") && e.includes("sentence") && e.includes("bar"))).toBe(true);
    // The error message must NOT advertise karaoke as a valid option.
    expect(result.errors.some((e) => /must be one of:[^,]*karaoke/i.test(e))).toBe(false);
  });
});

describe("normalizeSubtitleLayout — migration fallback (SUB-04, T-28-04)", () => {
  it("coerces a removed 'karaoke' value to 'tiktok'", () => {
    expect(normalizeSubtitleLayout("karaoke")).toBe("tiktok");
  });

  it("passes through valid modes unchanged", () => {
    expect(normalizeSubtitleLayout("sentence")).toBe("sentence");
    expect(normalizeSubtitleLayout("bar")).toBe("bar");
    expect(normalizeSubtitleLayout("tiktok")).toBe("tiktok");
  });

  it("coerces garbage / undefined to 'tiktok'", () => {
    expect(normalizeSubtitleLayout("garbage")).toBe("tiktok");
    expect(normalizeSubtitleLayout(undefined)).toBe("tiktok");
    expect(normalizeSubtitleLayout(null)).toBe("tiktok");
    expect(normalizeSubtitleLayout(123)).toBe("tiktok");
  });
});
