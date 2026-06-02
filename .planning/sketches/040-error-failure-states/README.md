---
sketch: 040
name: error-failure-states
question: "What does 'something broke' look like in the calm pro register, across the real failure modes (upload rejected, Whisper service unreachable, disk full, save failed, render OOM)?"
winner: "A"
tags: [frontier, errors, failure-states, edge-cases, recovery]
---

# Sketch 040: Error & Failure States

## Design Question
Sketch 008 covered the *happy-path-off* states (empty, 3/3 cap, no-video, Whisper-loading) and 035
covered render-OOM completion. But the genuine **error vocabulary** is unsketched. Where and how do
real faults surface in the calm pro register?

The real failure modes, grounded in the architecture:
- **Upload rejected** — corrupt MP4 / unsupported codec (`ffprobe: moov atom not found`) — *recoverable*
- **Whisper unreachable** — the externalized HTTP whisper-api (Phase 15) doesn't answer (`ECONNREFUSED`) — *fatal for transcription*
- **Disk full** — output volume out of space (`ENOSPC`) — *fatal for render*
- **Save failed** — `PUT /api/config` rejected (config persistence) — *recoverable*
- **Render OOM** — Chrome OOM, single-job constraint (`signal 9`) — *fatal for render* (035 recompose, editor-resident)

## How to View
open .planning/sketches/040-error-failure-states/index.html
→ Use the **"simular falla"** bar under the header to trigger each fault in each variant.

## Variants
- **A: Inline at source** — each fault appears where it originated (reject in the dropzone, Whisper-down over the stage, save-failed on the chip + button). No global error chrome; context explains the fault.
- **B: Header error banner** — one persistent banner under the header carries the active fault + cause + recovery action. Extends the 008/013 chip vocabulary into an error tone; a single place faults surface.
- **C: Severity triage** — recoverable faults stay inline (dropzone reject, chip retry); fatal/blocking faults (Whisper down, disk full, OOM) take a calm stage takeover that explains + offers the one recovery action. Gravity chooses the form.

## What to Look For
- Does an error ever read as alarming/red-heavy, or does it stay calm and pro?
- Is the **cause line** (the real `ECONNREFUSED` / `ENOSPC` / `signal 9`) reassuring-precise or too technical?
- For the fatal Whisper case: does "the rest of the editor still works" come across?
- Does B's single banner scale to *recoverable* faults too, or does it over-weight a small problem?
- Is C's recoverable-vs-fatal split legible, or arbitrary? (Likely synthesis: C's triage spine + A's at-source placement for recoverable + the chip as ambient carrier.)
- Green discipline: no error treatment should borrow the reserved action-green; danger is its own low-chroma red.
