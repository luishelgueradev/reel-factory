// ─── PositionPresets — shared 9-point position preset grid ───────────────────
// Decisions: D-07 (9-point grid), D-08 (shared component, enum mode for subtitles),
// D-09 (size-aware math, top-left anchor, 1080×1920 frame)
//
// Two modes:
//   px mode (default) — full 9-cell grid; click → onApply(x, y) with size-aware coords
//   enum mode — only the 3 reachable subtitle cells are enabled; click → onApplyAnchor(value)
//
// UI-SPEC §"Position Presets": 30px cells, 3px gap, blue active (never green)
// Color law (LOCKED): active = var(--accent-tint) bg + var(--accent-strong) border + var(--accent) color
// Touch target: 44×44px minimum wrapper (WCAG 2.5.5) around 30px visible cell

import React from "react";
import type { SubtitlePosition } from "../../pipeline-config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresetAnchorX = "left" | "center" | "right";
export type PresetAnchorY = "top" | "center" | "bottom";
export type SubtitleAnchor = SubtitlePosition; // "bottom-center" | "top-center" | "center-screen"

export interface PositionPresetsProps {
  // ── px mode (default — Titles & Overlays) ──
  elementWidth?: number;   // required in px mode
  elementHeight?: number;  // required in px mode
  frameWidth?: number;     // default 1080
  frameHeight?: number;    // default 1920
  onApply?: (x: number, y: number) => void; // px-mode click handler

  // ── enum mode (Subtitles) ──
  mode?: "px" | "enum";   // default "px"
  // Maps (anchorX, anchorY) composite key → SubtitlePosition enum value.
  // Only cells whose key is present are enabled; the rest are disabled.
  // Canonical 3-cell map: "center-bottom"→"bottom-center", "center-top"→"top-center",
  // "center-center"→"center-screen"
  anchorToValue?: Partial<Record<`${PresetAnchorX}-${PresetAnchorY}`, SubtitleAnchor>>;
  onApplyAnchor?: (value: SubtitleAnchor) => void; // enum-mode click handler

  // ── shared ──
  activeAnchor?: string; // drives blue highlight on the matching cell
}

// ─── Pure math helpers (exported for tests) ──────────────────────────────────

/**
 * Compute the rendered height of a PNG overlay element.
 *
 * PngOverlay renders with `width: displayWidth` and `height: auto`, so the
 * actual rendered height in 1080×1920 frame space is:
 *   displayWidth * (naturalHeight / naturalWidth)
 *
 * Falls back to `displayWidth` (square) when naturalWidth is 0, NaN, or
 * not finite — matching the old behaviour so nothing ever throws.
 */
export function computeOverlayElementHeight(
  displayWidth: number,
  naturalWidth: number,
  naturalHeight: number,
): number {
  if (!naturalWidth || !isFinite(naturalWidth)) {
    return displayWidth;
  }
  return Math.round(displayWidth * (naturalHeight / naturalWidth));
}

/**
 * Compute the top-left (x, y) pixel position for an element placed at the
 * given anchor within the frame. Rounds to integer px.
 *
 * left/top = 0
 * center   = round((frame - element) / 2)
 * right/bottom = round(frame - element)
 */
export function computePresetXY(
  anchorX: PresetAnchorX,
  anchorY: PresetAnchorY,
  elementWidth: number,
  elementHeight: number,
  frameWidth = 1080,
  frameHeight = 1920,
): { x: number; y: number } {
  const x = Math.max(0,
    anchorX === "left"
      ? 0
      : anchorX === "center"
        ? Math.round((frameWidth - elementWidth) / 2)
        : Math.round(frameWidth - elementWidth));

  const y = Math.max(0,
    anchorY === "top"
      ? 0
      : anchorY === "center"
        ? Math.round((frameHeight - elementHeight) / 2)
        : Math.round(frameHeight - elementHeight));

  return { x, y };
}

// ─── Cell descriptor table (9 cells, row order: ↖↑↗ / ←•→ / ↙↓↘) ────────────
// Each cell owns its anchorX, anchorY, directional glyph, and the Spanish
// accessible name that is emitted verbatim as the aria-label of its button.
// 9 cells = 9 button accessible names (Accessible Name Contract, UI-SPEC §"Position Presets").

interface CellDef {
  anchorX: PresetAnchorX;
  anchorY: PresetAnchorY;
  glyph: string;
  "aria-label": string; // Spanish accessible name — emitted directly on each button
}

// Row 1 — top
const CELL_TL: CellDef = { anchorX: "left",   anchorY: "top",    glyph: "↖", "aria-label": "Posición arriba-izquierda" };
const CELL_TC: CellDef = { anchorX: "center", anchorY: "top",    glyph: "↑", "aria-label": "Posición arriba-centro" };
const CELL_TR: CellDef = { anchorX: "right",  anchorY: "top",    glyph: "↗", "aria-label": "Posición arriba-derecha" };
// Row 2 — middle
const CELL_ML: CellDef = { anchorX: "left",   anchorY: "center", glyph: "←", "aria-label": "Posición centro-izquierda" };
const CELL_MC: CellDef = { anchorX: "center", anchorY: "center", glyph: "•", "aria-label": "Posición centro" };
const CELL_MR: CellDef = { anchorX: "right",  anchorY: "center", glyph: "→", "aria-label": "Posición centro-derecha" };
// Row 3 — bottom
const CELL_BL: CellDef = { anchorX: "left",   anchorY: "bottom", glyph: "↙", "aria-label": "Posición abajo-izquierda" };
const CELL_BC: CellDef = { anchorX: "center", anchorY: "bottom", glyph: "↓", "aria-label": "Posición abajo-centro" };
const CELL_BR: CellDef = { anchorX: "right",  anchorY: "bottom", glyph: "↘", "aria-label": "Posición abajo-derecha" };

const CELLS: readonly CellDef[] = [
  CELL_TL, CELL_TC, CELL_TR,
  CELL_ML, CELL_MC, CELL_MR,
  CELL_BL, CELL_BC, CELL_BR,
];

// ─── Styles ───────────────────────────────────────────────────────────────────
// Tokens from default.css (sketch-findings-reel-factory/sources/themes/default.css)

const GRID_STYLE: React.CSSProperties = {
  display: "inline-grid",
  gridTemplateColumns: "repeat(3, 30px)",
  gridAutoRows: "30px",
  gap: "3px",
};

const TRANSITION =
  "background var(--dur, 170ms) var(--ease, cubic-bezier(0.22,1,0.36,1))," +
  "color var(--dur, 170ms) var(--ease, cubic-bezier(0.22,1,0.36,1))," +
  "border-color var(--dur, 170ms) var(--ease, cubic-bezier(0.22,1,0.36,1))";

function cellStyle(isActive: boolean, isDisabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    width: "30px",
    height: "30px",
    borderRadius: "4px", // var(--r-xs)
    fontSize: "13px",
    display: "grid",
    placeItems: "center" as React.CSSProperties["placeItems"],
    padding: 0,
    lineHeight: 1,
  };

  if (isDisabled) {
    return {
      ...base,
      border: "1px solid var(--border, #333)",
      background: "var(--surface-2, #252535)",
      color: "var(--text-muted, #777)",
      opacity: 0.4,
      cursor: "not-allowed",
    };
  }

  if (isActive) {
    // Active cell: BLUE accent (color law — never green)
    return {
      ...base,
      border: "1px solid var(--accent-strong, #6ba8e0)",
      background: "var(--accent-tint, rgba(144,202,249,0.12))",
      color: "var(--accent, #90caf9)",
      cursor: "pointer",
      transition: TRANSITION,
    };
  }

  return {
    ...base,
    border: "1px solid var(--border, #333)",
    background: "var(--surface, #1e1e2e)",
    color: "var(--text-muted, #777)",
    cursor: "pointer",
    transition: TRANSITION,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PositionPresets({
  elementWidth = 0,
  elementHeight = 0,
  frameWidth = 1080,
  frameHeight = 1920,
  onApply,
  mode = "px",
  anchorToValue,
  onApplyAnchor,
  activeAnchor,
}: PositionPresetsProps): React.ReactElement {
  const isEnumMode = mode === "enum";

  return (
    <div style={GRID_STYLE} role="group">
      {CELLS.map((cell) => {
        const { anchorX, anchorY, glyph } = cell;
        const compositeKey = `${anchorX}-${anchorY}` as `${PresetAnchorX}-${PresetAnchorY}`;

        // Active state: px mode → composite key match; enum mode → enum value match
        let isActive = false;
        if (isEnumMode && anchorToValue) {
          const enumVal = anchorToValue[compositeKey];
          isActive = enumVal !== undefined && activeAnchor === enumVal;
        } else {
          isActive = activeAnchor === compositeKey;
        }

        // Enabled/disabled: px mode → all 9 enabled; enum mode → only mapped cells enabled
        const isDisabled = isEnumMode
          ? anchorToValue?.[compositeKey] === undefined
          : false;

        function handleClick() {
          if (isDisabled) return;
          if (isEnumMode) {
            const enumVal = anchorToValue?.[compositeKey];
            if (enumVal !== undefined && onApplyAnchor) {
              onApplyAnchor(enumVal);
            }
          } else {
            const { x, y } = computePresetXY(
              anchorX,
              anchorY,
              elementWidth,
              elementHeight,
              frameWidth,
              frameHeight,
            );
            onApply?.(x, y);
          }
        }

        return (
          // 44×44px touch target wrapper (WCAG 2.5.5) around the 30px visible cell
          <div
            key={compositeKey}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              margin: "-7px",
            }}
          >
            <button
              aria-label={cell["aria-label"]}
              aria-disabled={isDisabled ? "true" : undefined}
              disabled={isDisabled}
              onClick={handleClick}
              type="button"
              style={cellStyle(isActive, isDisabled)}
            >
              {glyph}
            </button>
          </div>
        );
      })}
    </div>
  );
}
