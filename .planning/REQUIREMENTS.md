# Requirements: v1.3 — Studio redesign + visual capabilities

Scoped requirements for milestone v1.3. REQ-IDs continue per-category numbering.
Traceability (phase mapping) is filled by the roadmapper.

## v1.3 Requirements

### Config Persistence (PERSIST)

- [x] **PERSIST-01**: User-saved studio config (subtitle styles + title blocks) survives a `docker compose build`/rebuild and container recreate — styles are not lost.
- [x] **PERSIST-02**: The active config is stored as inspectable JSON in a persistent location (bind mount or named volume), not the ephemeral image layer.

### Typography (TYPO)

- [ ] **TYPO-01**: User can select Plus Jakarta Sans for subtitles and titles.
- [ ] **TYPO-02**: User can set subtitle/title font sizes beyond the current maximum.
- [ ] **TYPO-03**: User can apply bold and italic variants to fonts.
- [ ] **TYPO-04**: User can apply an outer glow effect with configurable color, intensity, and softness.

### PNG Overlays (OVERLAY)

- [ ] **OVERLAY-01**: User can add a transparent PNG overlay onto the video.
- [ ] **OVERLAY-02**: A PNG larger than the frame is downscaled by code at render time for crisp output (supersampling approach).
- [ ] **OVERLAY-03**: User can position and size the PNG overlay.

### Title Blocks (TITLE)

- [ ] **TITLE-01**: User can position title blocks by pixel coordinates (not percentages).
- [ ] **TITLE-02**: User can configure border-radius on title block containers.
- [ ] **TITLE-03**: Title blocks have no subtitle field; a subtitle is added as a separate title block.

### Studio UI Redesign (STUDIO)

- [ ] **STUDIO-01**: Studio presents a single interface split into two vertical columns — left: video preview, right: controls.
- [ ] **STUDIO-02**: All controls live in the right panel, organized in tabs.
- [ ] **STUDIO-03**: The duplicated editor/preview screens and redundant components are consolidated/removed.

## Future Requirements (deferred)

- Multiple named config presets (save/load) — beyond single-active-config persistence.
- `.env`-level subtitle position knob (position is already configurable via studio config).

## Out of Scope

- Pipeline/processing changes (whisper, silence, encode) — v1.3 is studio + render visuals only.
- New output formats beyond 9:16 — unchanged from prior milestones.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PERSIST-01 | 17 | Validated (Phase 17, 2026-05-27) |
| PERSIST-02 | 17 | Validated (Phase 17, 2026-05-27) |
| STUDIO-01 | 18 | Planned |
| STUDIO-02 | 18 | Planned |
| STUDIO-03 | 18 | Planned |
| TYPO-01 | 19 | Planned |
| TYPO-02 | 19 | Planned |
| TYPO-03 | 19 | Planned |
| TYPO-04 | 19 | Planned |
| TITLE-01 | 20 | Planned |
| TITLE-02 | 20 | Planned |
| TITLE-03 | 20 | Planned |
| OVERLAY-01 | 21 | Planned |
| OVERLAY-02 | 21 | Planned |
| OVERLAY-03 | 21 | Planned |

---

**Non-negotiable tooling:** All frontend phases/tasks (STUDIO-*, and the studio-facing
parts of TYPO/OVERLAY/TITLE) MUST invoke the `impeccable` skill + `frontend-design`
plugin at the start of plan/execute (per AGENTS.md).
