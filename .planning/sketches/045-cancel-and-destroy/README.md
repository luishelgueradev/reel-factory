---
sketch: 045
name: cancel-and-destroy
question: "How do you abort a running render, and what's the one vocabulary for destructive/reversible actions (delete reel/preset/overlay, cancel queued job) — inline-undo vs toast-undo vs confirm?"
winner: "B"
tags: [frontier, destructive, cancel, render, undo, confirmation, interaction]
---

# Sketch 045: Cancel & Destroy

## Design Question
Two unsolved things, drawn together:
1. **Aborting a running render was never sketched.** Render runs on the dimmed stage (010-A),
   but there was no way to stop it — and renders are long + single-job (`MAX_CONCURRENT_JOBS=1`),
   so abort matters (it frees the queue, but discards minutes of Whisper + headless-Chrome compute).
2. **The destructive-action vocabulary is scattered** — delete a reel (038), delete a preset (034),
   remove an overlay (019/039), cancel a queued job (030) were each touched in isolation. This unifies
   them into one law, the way 041 unified layering.

## How to View
open .planning/sketches/045-cancel-and-destroy/index.html

Click the trash icons and the **Cancelar render** button in each variant to feel the difference.

## Variants
- **A: Toast-undo everywhere** — every destructive action executes instantly + a ~5s "Deshacer" toast. No dialogs. Cancel-render stops + offers "Reanudar". The Gmail/Linear idiom.
- **B: Tiered by cost** — reversible/cheap (remove overlay, delete preset, cancel queued job) = toast-undo; expensive/irreversible (abort render = lost compute, delete an MP4 from disk) = inline-confirm. The cost decides the friction. No modals.
- **C: Inline-confirm everywhere** — the destructive control morphs in place into "¿Eliminar? Sí · No". Cancel-render turns its own button into the confirm. Maximally consistent, but a click on every trivial action.

## What to Look For
- **The render-cancel hero** — does aborting on the dimmed stage feel right? In B/C it confirms *on the stage* (the stage is its own dialog, no modal); in A it's one click + Reanudar.
- **Does friction match consequence?** Removing an overlay (reversible) vs deleting an MP4 from disk (gone). B makes them feel different; A treats them the same; C makes both equally heavy.
- **No modals** — every pattern resolves inline or via toast (impeccable: modal as last resort). Confirm any of these reads as calmer than a dialog.
- **Green discipline + danger color** — danger is its own low-chroma red (`--danger`), never the reserved action-green; even the destructive "Eliminar" button never greens.
