# North-Star v3 — Canonical Screen (live preview folded in) — SUPERSEDED

⚠️ **Superseded by `north-star-v4.md` (sketch 037)** as the canonical whole-screen Editor view. v3's
*content* still holds — it's the live-preview milestone — but its **header-resident frame is stale**:
sketch 033 moved the brand into a left activity rail and made the header purely-contextual, and 037
recomposed this editor *inside* that rail shell. Read v4 for the current screen; keep v3 for the
caption-animation coherence findings it settled.

Historically the **canonical screen** for the Phase 22 redesign. **Superseded `north-star-v2.md` (sketch
023)** as the screen the real React build targets. 023-B was composed *before* sketch 025 retired the
static subtitle specimens, so its canonical drawing still froze the caption. v3 folds the **live
word-by-word caption preview** into the same committed-scope slice and re-verifies coherence. Read
every per-area reference first; this one only proves the *animated* composite still reads as one calm
tool and confirms the two-simultaneous-animations risk stays acceptable in the full screen.

## Design Decisions

### B — committed-scope slice + live preview (winner): what ships first
Identical to 023-B's ship-first cut — **but the caption now plays**:
- **013-B split-zone header** · **001-D three-column shell** · **4-tab bar** (Títulos · Overlays ·
  Subtítulos · **Video** pushed right via `margin-left:auto`) · list-forward Overlays (019-C) · font
  slide-over (016-C) · numeric title timing (022-B). Render **ghosted**, timeline **collapsed**,
  preview **click-to-select** (cheap 007 subset), metadata column **"Próximamente"**.
- **The caption animates** (025-C division of labor): the in-panel **specimen loops the *style***
  (judge highlight rhythm freely), the **stage transport scrubs the *real moment***. Both run at
  once — the commitment 025-C made, now proven in the full dense composite.

### The coherence finding this sketch settled
- **The moving caption stays ambient.** The calm ~90ms color transition on the highlighted word keeps
  it from pulling the eye off the controls — "the tool disappears into the task" survives a live
  preview. The composite reads as the **same calm panel**, not a video editor.
- **Two animations at once do NOT need a focus discipline.** Variant **C** added an auto-pause (playing
  the stage transport pauses the panel specimen) to resolve the competing-motion risk — but in the full
  composite the pause read as the panel "going dead," not as relief. The specimen loop + transport
  answer *different questions* (style vs. moment), so running both is fine. C is kept only as the
  focus-disciplined alternative if real footage proves louder than the sketch.

### A — everything-on (the aspiration)
Live preview **+** awake per-platform metadata (026-C) **+** timeline open (020-C) **+** Render
available (010-A) **+** drag-on-preview (007). The full picture once every post-016 sketch ships;
held back as the frontier target, exactly as 015/023 framed it.

### The scope line (unchanged)
**Ship B first; A's frontier layers (007 drag · 010 render · 020 timeline · awake metadata) bolt on
later without rework.** The A↔B contrast is still the plan-split boundary.

## CSS Patterns

All patterns use the shared tokens in `sources/themes/default.css`. The shell/header/tab-bar/timeline
CSS is unchanged from `north-star-v2.md` (see it for `.work`/`.leftcol`/`.tl-dock`/`.video-tab`).
What v3 adds is the **live caption** — one renderer, two drivers:

### One `paint()` renderer, two drivers (025-C)
```js
// shared word painter — the ONLY place a caption word is drawn
function paint(target, ws, idx, mode){ /* renders words, idx = active (highlighted) word */ }

// driver 1 — stage transport: idx derived from the real playhead
if (stageCap){ const sidx = Math.min(ws.length-1, Math.floor(v.playhead/100*ws.length));
               paint(stageCap, ws, sidx, v.mode); }
// driver 2 — panel specimen: idx free-loops the style on its own clock
paint(specCap, ws, specIdx >= ws.length ? -1 : specIdx, v.mode);
```
The two callers share **one** paint function and one `mode`; never fork the word renderer per surface.
See `caption-animation-preview.md` for the full division-of-labor rationale.

### Live tag — ambient "playing" indicator (not a loud badge)
```css
.live-tag .rdot { width:6px; height:6px; border-radius:50%; background:var(--text-faint); }
.live-tag.playing .rdot { background:var(--danger); animation:blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity:0.25; } }   /* the ONLY blinking element; everything else stays calm */
```

## What to Avoid
- **Don't reference 023 (v2) as the current screen** — v3 supersedes it. v2 stays as the historical
  pre-live-preview composite; v3 is what the build targets.
- **Don't add a one-animation-at-a-time discipline by default** (variant C). The auto-pause read as the
  panel going dead in the full composite. Keep both running; revisit only if real footage proves louder.
- **Don't fork the caption renderer** between the stage and the specimen — one `paint()`, two callers.
- **Don't let the live caption become loud.** The `.rdot` blink is the only animated attention-grabber;
  the highlighted word uses the calm ~90ms color transition, nothing flashier.
- **Don't ship A's frontier layers in the committed slice.** B is the planning boundary; A is the target.

## Origin
Synthesized from sketch 027 (north-star-v3, winner B — committed slice + live preview; A = everything-on,
C = one-animation-at-a-time discipline). Recomposes 023-B's canonical shell with 025-C's live caption.
Supersedes `references/north-star-v2.md` (sketch 023), which supersedes `north-star-composite.md`
(sketch 015). Source file in `sources/027-north-star-v3/` (winner `#v-b`, marked ★ in the variant nav).
