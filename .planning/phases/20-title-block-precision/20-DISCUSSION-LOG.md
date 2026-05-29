# Phase 20: Title block precision - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 20-title-block-precision
**Areas discussed:** Positioning UX, Coordinate model, topOffset migration, Subtitle removal scope

---

## Positioning UX

| Option | Description | Selected |
|--------|-------------|----------|
| Typed number inputs | Two input fields (X px, Y px) in TitleEditor — simple, precise | ✓ |
| Drag-to-place on preview | Drag the block on the studio preview; requires click/drag handlers and coordinate math | |
| Both (inputs + drag) | Typed inputs as primary, drag as secondary shortcut — doubles implementation | |

**User's choice:** Typed number inputs
**Notes:** No drag-to-place for this phase.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 0–1920 for Y, 0–1080 for X | Full frame coverage matching the 9:16 1080×1920 canvas | ✓ |
| Constrained to safe zone | Enforce margins (40–1040 x, 80–1840 y) to prevent edge clipping | |
| You decide | Defer range to impeccable + frontend-design | |

**User's choice:** 0–1920 for Y, 0–1080 for X
**Notes:** Full coverage, no safe-zone enforcement.

---

## Coordinate model

| Option | Description | Selected |
|--------|-------------|----------|
| 1080×1920 render space | Pixels map directly to the rendered video frame; preview scales proportionally | ✓ |
| Percentage-of-preview display | Coordinates relative to visible preview size — less predictable | |

**User's choice:** 1080×1920 render space
**Notes:** Pixel-perfect positioning: what you type = what lands in the render.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Top-left corner of the block | x=0, y=0 places the block's top-left at the frame corner; standard CSS model | ✓ |
| Center of the block | x/y point to the block center (x=540, y=960 = centered) | |

**User's choice:** Top-left corner of the block
**Notes:** CSS: left=${(x/1080)*100}%, top=${(y/1920)*100}% — no center transform.

---

## topOffset migration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with x/y pixel fields (clean break) | Remove topOffset; add x and y. Existing configs lose positioning — defaults apply | ✓ |
| Keep topOffset, add x/y alongside | Dual-path fallback; backward compat but messy schema | |
| Keep topOffset but convert on load | Auto-convert topOffset% to y pixel value on load | |

**User's choice:** Replace with x/y pixel fields (clean break)
**Notes:** Existing saved configs with topOffset will lose their positioning value on the next load.

---

| Option | Description | Selected |
|--------|-------------|----------|
| x:0, y:960 (vertically centered, left edge) | y=960 is vertical center of 1920px frame | |
| x:200, y:960 (centered-ish, common starting point) | Roughly matches prior default topOffset=50% with left inset | ✓ |
| You decide | Let impeccable + frontend-design pick | |

**User's choice:** x:200, y:960

---

## Subtitle removal scope

| Option | Description | Selected |
|--------|-------------|----------|
| Clean schema removal | Remove subtitle from TitleConfig, TitleStyleProps, TitleOverlay; no migration | ✓ |
| UI-only removal | Remove from TitleEditor only; keep in schema for backward compat | |
| Migrate to new block | Auto-add a second TitleConfig entry from the subtitle value | |

**User's choice:** Clean schema removal
**Notes:** Consistent with "a subtitle is a separate title block". No migration needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remove them all (clean sweep) | Remove subtitleFontSize, subtitleColor, subtitleFontFamily from TitleStyleProps | ✓ |
| Keep them (might reuse later) | Keep the fields as no-ops | |
| You decide | Defer to planner | |

**User's choice:** Remove them all (clean sweep)
**Notes:** subtitleFontSize, subtitleColor, subtitleFontFamily removed atomically with subtitle.

---

## Claude's Discretion

- Slider range for `borderRadius` input (suggested 0–50px, 12 as default)
- Label wording: "X" / "Y" vs "Left offset" / "Top offset"
- Visual layout of the two coordinate inputs in TitleEditor
- Default `borderRadius` for existing configs (12 recommended — matches prior hardcoded value)

## Deferred Ideas

- **Drag-to-place on preview** — position title blocks by dragging on the studio video preview. Noted during Positioning UX discussion; deferred for a future enhancement.
