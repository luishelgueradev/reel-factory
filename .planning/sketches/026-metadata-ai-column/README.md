---
sketch: 026
name: metadata-ai-column
question: "The metadata column has been 'Próximamente' in all 22 sketches — the largest unsketched surface. What does the AI social-metadata panel actually look like awake: generate, edit título/descripción/hashtags, regenerate, copy — and per-platform?"
winner: "C"
tags: [frontier, metadata, ai, social, deferred-surface, phase-22]
---

# Sketch 026: Metadata / AI Column

## Design Question
The right column of the 3-column shell has been a **"Próximamente" placeholder in every single
sketch** (001–025) — the largest surface of the tool never explored. It's reserved for the AI phase:
generating social-media metadata (title, description, hashtags) from the transcription + the reel's
titles. This sketch finally draws it **awake**: how do you trigger generation, edit the result,
regenerate, copy for publishing — and does it adapt per platform?

**Green discipline note:** "Generar" is a *secondary* action — it uses **accent (blue)**, never the
reserved action-green (which stays on Render / Guardar). Verify that holds across all three variants.

## How to View
open .planning/sketches/026-metadata-ai-column/index.html

(The editor side is intentionally dimmed — the metadata column is the subject.)

## Variants
- **A: Generate on demand** — the column starts with an empty-state CTA ("✦ Generar metadata", accent).
  Click → shimmer → fields wake in. Manual, explicit; you decide when. Click **Generar** to see it,
  then **Regenerar** to replay.
- **B: Render byproduct (auto)** — the metadata is generated *automatically* when the render finishes;
  the column arrives pre-filled and editable, with a source note ("transcripción + títulos") and a
  Regenerar foot. Zero-effort; tied to the pipeline completion.
- **C ★: Per-platform tabs** — TikTok / Reels / Shorts sub-tabs, each with a tailored caption, its own
  character-limit counter, and platform-appropriate hashtag sets. Switch platforms to see the caption,
  limit, and hashtags re-tune. The most "publishing tool" of the three.

## What to Look For
- Does the empty-state CTA (A) make the column's *purpose* obvious before it's ever used — better than
  a dead "Próximamente" badge?
- Editing: every field is editable in place. Does inline editing + copy feel like enough, or does it
  want a richer composer?
- In C, switch platforms and watch the **char counter** (Shorts' 100-char title turns red when over) —
  does per-platform tailoring feel essential or like over-scope for v1?
- Generate vs auto (A vs B): should metadata be a deliberate action or a silent render byproduct?
- Confirm **green discipline**: the only green on screen is Render in the header; Generar is blue.
- Does this column, awake, justify its persistent ~320–340px width across all the *other* sketches?

## Outcome — Winner: C (per-platform tabs)
The AI column's north star is **per-platform** (TikTok / Reels / Shorts): each with a tailored caption,
its own char-limit counter, and platform-appropriate hashtags. Chosen over generate-on-demand (A) and
render-byproduct (B) — the column's real value is publishing-ready output adapted to where the reel
goes, not one generic blob. **Green discipline held** (Generar/copy are accent, never the reserved
action-green). Remains reserved for the AI phase; this is the forward-looking target. Lands on
**024-B's** results screen.
