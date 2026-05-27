# Phase 18: Studio UI redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 18-studio-ui-redesign
**Areas discussed:** Tab structure, Editor-only features, Redesign depth, Save & live model

---

## Tab structure

### Tab scheme
| Option | Description | Selected |
|--------|-------------|----------|
| Subtitles / Titles / Text | 3 tabs: Subtitles (layout+style), Titles, Text (sample text) | ✓ |
| Layout / Style / Titles / Text | 4 tabs, layout and style separate | |
| Style / Titles | 2 tabs, denser | |

**User's choice:** Subtitles / Titles / Text

### Default tab
| Option | Description | Selected |
|--------|-------------|----------|
| Subtitles/Style | Open subtitle layout+style first | |
| Titles | Open Titles tab first | ✓ |
| You decide | Planning picks | |

**User's choice:** Titles
**Notes:** Slightly unusual default (vs Subtitles) — honored as stated.

---

## Editor-only features

### Render Video button
| Option | Description | Selected |
|--------|-------------|----------|
| Drop it | Remove the non-functional 501 button | |
| Keep as-is | Carry over, still 501 | |
| Keep but disable | Greyed-out "coming soon", no 501 fire | ✓ |

**User's choice:** Keep but disable

### Raw-JSON ConfigPreview panel
| Option | Description | Selected |
|--------|-------------|----------|
| Drop it | Remove; live preview + on-disk file suffice | ✓ |
| Fold into a tab | Advanced/JSON tab for debugging | |
| Keep visible | Always-shown JSON readout | |

**User's choice:** Drop it

### Font Grid (/preview/fonts)
| Option | Description | Selected |
|--------|-------------|----------|
| Keep as separate route | Leave standalone, just link | |
| Fold into Subtitles tab | Integrate font browsing into unified screen | ✓ |
| Drop it | Remove entirely | |

**User's choice:** Fold into Subtitles tab

---

## Redesign depth

### Depth
| Option | Description | Selected |
|--------|-------------|----------|
| Design-system pass | Tokens + primitives + UI on top | |
| Restructure only | Reorganize existing styles into tabs, no system | |
| Restructure + light polish | Two-column tabs + modest visual cleanup, no token system | ✓ |

**User's choice:** Restructure + light polish

### Forward fit
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, design for extension | Tab/control framework anticipates phases 19-21 | ✓ |
| Just this phase | Solve current consolidation only | |

**User's choice:** Yes, design for extension
**Notes:** Extensible structure without a formal token system — both decisions co-exist.

---

## Save & live model

### Save model
| Option | Description | Selected |
|--------|-------------|----------|
| Keep manual Save | Explicit Save button, live preview in-memory | ✓ |
| Autosave (debounced) | Auto-persist on change | |
| Autosave + manual override | Debounced autosave + status indicator | |

**User's choice:** Keep manual Save

### Title preview state
| Option | Description | Selected |
|--------|-------------|----------|
| Keep the split | previewTitles vs titles preserved | |
| Unify (live = saved) | Titles behave like other controls | ✓ |
| You decide | Planning chooses | |

**User's choice:** Unify (live = saved)

---

## Claude's Discretion

- Tab-bar component/visual treatment, header/toolbar contents post-consolidation, responsive behavior, Font Grid layout inside the Subtitles tab.
- Whether removed routes (`/editor`, `/preview/fonts`) 301-redirect to the unified screen or are deleted.

## Deferred Ideas

- Formal design-token system (deferred to a dedicated design-system effort).
- Functional studio-side render trigger (button stays disabled this phase).
- Autosave (rejected for this phase; manual Save stays).
