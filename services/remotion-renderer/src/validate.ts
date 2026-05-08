/**
 * Validation utilities for Remotion renderer output.
 * Checks SUBT-01, SUBT-02, SUBT-03 requirements and D-01 through D-13 decisions.
 * Follows the same pattern as whisper/validate.py and silence-cutter/validate.py:
 * returns an array of error strings referencing requirement/decision IDs.
 */

import fs from "fs";

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
  console.log("VALIDATION PASSED: All SUBT requirements met");
}