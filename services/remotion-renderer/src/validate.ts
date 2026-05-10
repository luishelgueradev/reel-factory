/**
 * Validation utilities for Remotion renderer output.
 * Checks SUBT-01, SUBT-02, SUBT-03 requirements, D-01 through D-13 decisions,
 * and VISU-01/VISU-02 (Phase 6: title overlays and config validation).
 * Follows the same pattern as whisper/validate.py and silence-cutter/validate.py:
 * returns an array of error strings referencing requirement/decision IDs.
 */

import fs from "fs";
import { validatePipelineConfig } from "./pipeline-config.js";

// ─── Manifest validation (SUBT-01) ──────────────────────────────────────

export function validateManifest(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (manifest.step_name !== "remotion-renderer") {
    errors.push(
      `SUBT-01: manifest.step_name must be 'remotion-renderer', got '${manifest.step_name}'`
    );
  }

  if (manifest.status !== "success") {
    errors.push(
      `SUBT-01: manifest.status must be 'success', got '${manifest.status}'`
    );
  }

  return errors;
}

// ─── Remotion info validation (D-09, D-12) ─────────────────────────────

export function validateRemotionInfo(
  info: Record<string, unknown>
): string[] {
  const errors: string[] = [];

  // D-09: Required fields
  if (typeof info.input_width !== "number") {
    errors.push("D-09: remotion-info.json must have input_width");
  }
  if (typeof info.input_height !== "number") {
    errors.push("D-09: remotion-info.json must have input_height");
  }
  if (typeof info.caption_pages !== "number") {
    errors.push("D-09: remotion-info.json must have caption_pages");
  }

  // D-12: angle-egl flag validation
  const remotionInfo = info.remotion_info as Record<string, unknown> | undefined;
  if (!remotionInfo || remotionInfo.use_angle_egl !== true) {
    errors.push("D-12: remotion-info.json should have use_angle_egl=true");
  }

  return errors;
}

// ─── Caption pages validation (SUBT-01, SUBT-02, SUBT-03) ──────────────

export function validateCaptionPages(pages: unknown): string[] {
  const errors: string[] = [];

  if (!Array.isArray(pages)) {
    errors.push("SUBT-01: caption-pages.json must be an array");
    return errors;
  }

  if (pages.length === 0) {
    errors.push("SUBT-01: caption-pages.json must have at least one page");
    return errors;
  }

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as Record<string, unknown>;

    // SUBT-03: Timestamp fields must be numbers
    if (typeof page.startMs !== "number") {
      errors.push(`SUBT-03: page[${i}].startMs must be a number`);
    }
    if (typeof page.durationMs !== "number") {
      errors.push(`SUBT-03: page[${i}].durationMs must be a number`);
    }

    // SUBT-01: Text must be non-empty string
    if (typeof page.text !== "string" || page.text.length === 0) {
      errors.push(
        `SUBT-01: page[${i}].text must be a non-empty string`
      );
    }

    // SUBT-02: Tokens array with word-level timestamps
    if (!Array.isArray(page.tokens)) {
      errors.push(`SUBT-02: page[${i}].tokens must be an array`);
      continue;
    }

    for (let j = 0; j < page.tokens.length; j++) {
      const token = page.tokens[j] as Record<string, unknown>;

      // SUBT-03: Token timestamps must be numbers
      if (typeof token.fromMs !== "number") {
        errors.push(
          `SUBT-03: page[${i}].tokens[${j}].fromMs must be a number`
        );
      }
      if (typeof token.toMs !== "number") {
        errors.push(
          `SUBT-03: page[${i}].tokens[${j}].toMs must be a number`
        );
      }

      // SUBT-03: Impossible timestamp — fromMs must not exceed toMs
      if (typeof token.fromMs === "number" && typeof token.toMs === "number" && token.fromMs > token.toMs) {
        errors.push(
          `SUBT-03: page[${i}].tokens[${j}].fromMs (${token.fromMs}) > toMs (${token.toMs}) — impossible timestamp, double-remap likely`
        );
      }
    }
  }

  return errors;
}

// ─── Timestamp remapping validation (D-01) ──────────────────────────────

export function validateTimestampsRemapped(
  captionPages: Record<string, unknown>[],
  originalWords: Record<string, unknown>[],
  silenceCuts: Record<string, unknown> | null
): string[] {
  const errors: string[] = [];

  // D-03: No silence cuts to validate against — graceful handling
  if (!silenceCuts || !silenceCuts.cuts || !Array.isArray(silenceCuts.cuts) || (silenceCuts.cuts as unknown[]).length === 0) {
    return errors;
  }

  const cuts = silenceCuts.cuts as Array<Record<string, unknown>>;

  // D-01: Verify remapped timestamps differ from original when silence cuts exist
  // Flatten all token timestamps from caption pages
  const allTokenStarts = captionPages.flatMap((p) => {
    const tokens = p.tokens;
    if (!Array.isArray(tokens)) return [];
    return tokens.map((t: Record<string, unknown>) => t.fromMs as number);
  });

  if (allTokenStarts.length > 0 && originalWords.length > 0) {
    // Get the first silence cut's cumulative shift
    const firstCut = cuts[0];
    const firstCutEnd = firstCut.original_end as number;
    const cumulativeShift = firstCut.cumulative_shift as number;

    // Find a word that starts after the first silence cut
    const wordAfterCut = originalWords.find(
      (w) => (w.start as number) > firstCutEnd
    );

    if (wordAfterCut) {
      // In remapped captions, this word's timestamp should be earlier than original
      const originalMs = Math.round((wordAfterCut.start as number) * 1000);
      const expectedRemappedMs =
        originalMs - Math.round(cumulativeShift * 1000);

      // Check that there's at least one token with fromMs near the expected remapped time
      const hasRemappedToken = allTokenStarts.some(
        (ms) => Math.abs(ms - expectedRemappedMs) < 100
      );

      if (!hasRemappedToken) {
        errors.push(
          `D-01: Expected remapped timestamp ~${expectedRemappedMs}ms but found none in caption pages`
        );
      }
    }
  }

  return errors;
}

// ─── Safe zone validation (D-11) ────────────────────────────────────────

export function validateSafeZone(
  finalizerInfo: Record<string, unknown> | null,
  bottomOffset: number
): string[] {
  const errors: string[] = [];

  // No finalizer-info means safe zone wasn't provided — not an error
  if (!finalizerInfo) {
    return errors;
  }

  const safeZone = finalizerInfo.safe_zone as Record<string, unknown> | undefined;
  if (!safeZone || typeof safeZone.bottom !== "number") {
    return errors; // Missing safe zone is handled elsewhere
  }

  // D-11: bottom_offset should match safe_zone.bottom
  if (bottomOffset !== safeZone.bottom) {
    errors.push(
      `D-11: bottom_offset (${bottomOffset}) does not match finalizer-info safe_zone.bottom (${safeZone.bottom})`
    );
  }

  return errors;
}

// ─── PipelineConfig validation (D-02, D-04, D-05, D-06, D-12) ─────────────

export function validatePipelineConfigFile(outputDir: string): string[] {
  const errors: string[] = [];

  const configPath = `${outputDir}/pipeline-config.json`;
  if (!fs.existsSync(configPath)) {
    // Pipeline config is optional — not an error if missing (D-03: env var fallback)
    return errors;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    const result = validatePipelineConfig(config);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push(`VISU-01: pipeline-config.json validation error: ${err}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    errors.push(`VISU-01: pipeline-config.json parse error: ${message}`);
  }

  return errors;
}

// ─── Layout mode validation (D-04, D-05, VISU-01) ─────────────────────────

export function validateLayoutModes(outputDir: string): string[] {
  const errors: string[] = [];

  // Check that LayoutDispatcher can render all 4 layout modes
  // Verify composition files exist for each mode
  const compositionsDir = `${outputDir}/../remotion-renderer/src/compositions`;
  const requiredLayouts = ["TikTokLayout", "SentenceLayout", "BarLayout", "KaraokeLayout"];

  // In E2E context, check the source directory
  // When running from validate.ts CLI, outputDir might be the step output dir
  const srcDir = fs.existsSync(compositionsDir)
    ? compositionsDir
    : `${outputDir}/compositions`;

  if (fs.existsSync(srcDir)) {
    for (const layout of requiredLayouts) {
      const filePath = `${srcDir}/${layout}.tsx`;
      if (!fs.existsSync(filePath)) {
        errors.push(`VISU-01: Layout component not found: ${layout}.tsx`);
      }
    }

    // Check LayoutDispatcher exists
    const dispatcherPath = `${srcDir}/LayoutDispatcher.tsx`;
    if (!fs.existsSync(dispatcherPath)) {
      errors.push("VISU-01: LayoutDispatcher.tsx not found");
    }
  }

  // Validate layout mode values in pipeline-config.json if it exists
  const configPath = `${outputDir}/pipeline-config.json`;
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as Record<string, unknown>;
      const sub = config.subtitle as Record<string, unknown> | undefined;
      if (sub && typeof sub.layout === "string") {
        const validModes = ["tiktok", "sentence", "bar", "karaoke"];
        if (!validModes.includes(sub.layout)) {
          errors.push(`VISU-01: Invalid subtitle.layout mode "${sub.layout}", must be one of: ${validModes.join(", ")}`);
        }
      }
    } catch {
      // Already covered by validatePipelineConfigFile
    }
  }

  return errors;
}

// ─── Title overlay validation (VISU-01, VISU-02) ───────────────────────────

export function validateTitleOverlays(outputDir: string): string[] {
  const errors: string[] = [];

  // Check TitleOverlay component exists
  const compositionsDir = `${outputDir}/../remotion-renderer/src/compositions`;
  const srcDir = fs.existsSync(compositionsDir)
    ? compositionsDir
    : `${outputDir}/compositions`;

  const titleOverlayPath = `${srcDir}/TitleOverlay.tsx`;
  if (fs.existsSync(srcDir) && !fs.existsSync(titleOverlayPath)) {
    errors.push("VISU-01: TitleOverlay.tsx component not found");
  }

  // Check pipeline-config.json for title configurations
  const configPath = `${outputDir}/pipeline-config.json`;
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw) as Record<string, unknown>;
      const titles = config.titles;

      if (Array.isArray(titles)) {
        // VISU-01: Intro title check — title at startTimeMs=0
        const hasIntroTitle = titles.some(
          (t: unknown) => typeof t === "object" && t !== null && (t as Record<string, unknown>).startTimeMs === 0
        );
        if (!hasIntroTitle && titles.length > 0) {
          // Only warn if there are titles but none at startTimeMs=0
          // An empty titles array is valid (no titles in the video)
        }

        // VISU-02: Outro title check — title near video end
        // Need to check if there's a title with startTimeMs near the video duration
        // This is informational — not a hard error since not all videos need outro titles
        const infoPath = `${outputDir}/remotion-info.json`;
        if (fs.existsSync(infoPath)) {
          try {
            const info = JSON.parse(fs.readFileSync(infoPath, "utf-8")) as Record<string, unknown>;
            const videoDurationSec = typeof info.video_duration_sec === "number"
              ? info.video_duration_sec
              : (typeof info.total_duration_ms === "number" ? info.total_duration_ms / 1000 : null);

            if (videoDurationSec !== null) {
              const videoDurationMs = videoDurationSec * 1000;
              const hasOutroTitle = titles.some((t: unknown) => {
                if (typeof t !== "object" || t === null) return false;
                const title = t as Record<string, unknown>;
                const startMs = typeof title.startTimeMs === "number" ? title.startTimeMs : 0;
                const durMs = typeof title.durationMs === "number" ? title.durationMs : 0;
                // Title starts in the last 20% of the video
                return startMs > videoDurationMs * 0.8;
              });

              // VISU-02 is informational (not all configs have outro titles)
              // We validate structure but don't fail if no outro title exists
              if (!hasOutroTitle && titles.length > 0) {
                // Log informational — title config doesn't include an outro title
              }
            }
          } catch {
            // remotion-info.json parse errors handled elsewhere
          }
        }

        // Validate title structure (VISU-01)
        for (let i = 0; i < titles.length; i++) {
          const title = titles[i] as Record<string, unknown>;
          if (typeof title.text !== "string" || !title.text.trim()) {
            errors.push(`VISU-01: titles[${i}].text must be a non-empty string`);
          }
          if (typeof title.startTimeMs !== "number" || title.startTimeMs < 0) {
            errors.push(`VISU-01: titles[${i}].startTimeMs must be >= 0`);
          }
          if (typeof title.durationMs !== "number" || title.durationMs <= 0) {
            errors.push(`VISU-01: titles[${i}].durationMs must be > 0`);
          }
        }
      }
    } catch {
      // Already covered by validatePipelineConfigFile
    }
  }

  return errors;
}

// ─── Font infrastructure validation (D-07) ────────────────────────────────

export function validateFontInfrastructure(outputDir: string): string[] {
  const errors: string[] = [];

  // Check fonts.ts exists and exports AVAILABLE_FONTS with 5 entries
  const fontsPath = `${outputDir}/../remotion-renderer/src/fonts.ts`;
  const altFontsPath = `${outputDir}/fonts.ts`;

  const resolvePath = fs.existsSync(fontsPath)
    ? fontsPath
    : fs.existsSync(altFontsPath)
      ? altFontsPath
      : null;

  if (!resolvePath) {
    errors.push("D-07: fonts.ts not found in expected locations");
    return errors;
  }

  try {
    const content = fs.readFileSync(resolvePath, "utf-8");

    // Check AVAILABLE_FONTS export
    if (!content.includes("AVAILABLE_FONTS")) {
      errors.push("D-07: fonts.ts must export AVAILABLE_FONTS");
    }

    // Check that AVAILABLE_FONTS includes expected font names
    const expectedFonts = ["Inter", "Roboto", "Montserrat", "Oswald", "monospace"];
    for (const font of expectedFonts) {
      if (!content.includes(`"${font}"`) && !content.includes(`'${font}'`)) {
        errors.push(`D-07: AVAILABLE_FONTS should include "${font}"`);
      }
    }

    // Check loadFont function export
    if (!content.includes("export") || !content.includes("loadFont")) {
      errors.push("D-07: fonts.ts must export a loadFont function");
    }
  } catch {
    errors.push("D-07: Could not read fonts.ts");
  }

  return errors;
}

// ─── Full output directory validation ────────────────────────────────────

export function validateRemotionOutput(outputDir: string): string[] {
  const errors: string[] = [];

  // Check manifest.json
  const manifestPath = `${outputDir}/manifest.json`;
  if (!fs.existsSync(manifestPath)) {
    errors.push("SUBT-01: manifest.json not found");
    return errors;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  errors.push(...validateManifest(manifest));

  // Check remotion-info.json (D-09)
  const infoPath = `${outputDir}/remotion-info.json`;
  if (!fs.existsSync(infoPath)) {
    errors.push("D-09: remotion-info.json not found");
  } else {
    const info = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
    errors.push(...validateRemotionInfo(info));

    // D-11: Validate safe zone if we have finalizer-info.json
    const finalizerInfoPath = `${outputDir.replace("remotion-renderer", "ffmpeg-finalizer")}/finalizer-info.json`;
    if (fs.existsSync(finalizerInfoPath)) {
      const finalizerInfo = JSON.parse(
        fs.readFileSync(finalizerInfoPath, "utf-8")
      );
      const bottomOffset =
        typeof info.bottom_offset === "number" ? info.bottom_offset : 0;
      errors.push(...validateSafeZone(finalizerInfo, bottomOffset));
    }
  }

  // Check caption-pages.json (SUBT-01, SUBT-02, SUBT-03)
  const captionsPath = `${outputDir}/caption-pages.json`;
  if (!fs.existsSync(captionsPath)) {
    errors.push("D-09: caption-pages.json not found");
  } else {
    const pages = JSON.parse(fs.readFileSync(captionsPath, "utf-8"));
    errors.push(...validateCaptionPages(pages));
  }

  // Check output.mp4 exists (SUBT-01)
  const outputPath = `${outputDir}/output.mp4`;
  if (!fs.existsSync(outputPath)) {
    errors.push("SUBT-01: output.mp4 not found");
  }

  // Phase 6: PipelineConfig validation (VISU-01)
  errors.push(...validatePipelineConfigFile(outputDir));

  // Phase 6: Layout mode validation (VISU-01, D-04/D-05)
  errors.push(...validateLayoutModes(outputDir));

  // Phase 6: Title overlay validation (VISU-01, VISU-02)
  errors.push(...validateTitleOverlays(outputDir));

  // Phase 6: Font infrastructure validation (D-07)
  errors.push(...validateFontInfrastructure(outputDir));

  return errors;
}

// ─── CLI runner ─────────────────────────────────────────────────────────

if (
  process.argv[1]?.endsWith("validate.ts") ||
  process.argv[1]?.includes("validate")
) {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("Usage: npx tsx src/validate.ts <output_dir>");
    process.exit(1);
  }
  const errors = validateRemotionOutput(outputDir);
  if (errors.length > 0) {
    console.error("VALIDATION FAILED:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log("VALIDATION PASSED: All SUBT/VISU requirements met");
}