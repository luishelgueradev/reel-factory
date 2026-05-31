# Motion & Timing

## Design Decisions

**Winner: Sketch 009 variant A — Calm (170ms, ease-out-quart). The existing theme tokens are
confirmed.**

The five panel micro-motions — **tab switch · textarea expand-on-focus · preset flash · drag snap ·
save confirm** — composed in one shell, **cohere as a single motion vocabulary** because they share
one curve family (ease-out-quart) and durations proportional to how far each element travels.

### Two-tier timing
| Tier | Token | Value | Used for |
|------|-------|-------|----------|
| State changes | `--dur` | 170ms | tab underline, preset flash, save morph, focus rings, enable/disable |
| Position travel | `--dur2` | ~300ms | drag snap to anchor, X/Y glide between positions |
| Curve | `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | everything (ease-out-quart) |

Quick state changes at `--dur`, slightly longer position glides at `--dur2` — this reads as
intentional, not inconsistent.

### Why Calm won
- **Stays invisible at operating cadence** — you tune a reel with *many* small adjustments; Calm
  remains unobtrusive after the 20th preset click.
- **Snappy (100ms) tipped into abrupt/mechanical** — on the save morph and tab underline, a beat of
  motion *is* the reassurance; removing it felt cheap.
- **Expressive (240ms + larger translate/scale enter) crossed into "I'm waiting for the panel"** —
  the exact failure mode a dense, high-frequency pro tool can't afford.

## Reduced-motion mandate (REQUIRED in the real build)

All five motions **must collapse under `prefers-reduced-motion`** to instant state changes — no
travel, no enter translate/scale. This was not shown in the sketch but is non-negotiable for the
build.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  /* drag snap / X-Y glide jump instantly; no body-enter translate */
}
```

## CSS Patterns

```css
:root { --dur: 170ms; --dur2: 300ms; --ease: cubic-bezier(0.22, 1, 0.36, 1); }

/* state change — 170ms */
.tab-underline { transition: transform var(--dur) var(--ease); }
.xy-input.flash { animation: flash var(--dur) var(--ease); }       /* preset apply */
@keyframes flash { from { background: var(--accent-soft); } to { background: var(--surface-2); } }

/* position travel — 300ms */
.preview-element { transition: top var(--dur2) var(--ease), left var(--dur2) var(--ease); }

/* subtle body enter on tab switch — 4px, not 10px */
.tab-body { animation: enter var(--dur) var(--ease); }
@keyframes enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
```

## What to Avoid
- **Sub-120ms "instant" timing** — abrupt/mechanical on the save morph and tab underline; loses the
  reassuring beat.
- **240ms+ with a large (10px) translate/scale enter** — feels slow and "alive" in a way that fights
  a panel you operate constantly.
- **One flat duration for everything** — state changes and position travel need the two-tier split,
  or glides feel rushed and state changes feel sluggish.
- **Shipping without the `prefers-reduced-motion` collapse** — accessibility regression.

## Origin
Synthesized from sketch: 009 (winner A)
Source file available in: sources/009-motion-coherence/index.html
