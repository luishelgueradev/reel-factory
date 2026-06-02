---
sketch: 038
name: resultados-library
question: "The rail (033-B) promises Resultados as a persistent destination, but only its post-render takeover moment (024-B) was ever drawn. What's there when you open it later — a browsable library/history of finished reels (thumbnail · file · date · download/re-render · per-platform metadata), grounded in the real output/ dir?"
winner: "A"
tags: [frontier, results, library, history, output, scope-expanding]
---

# Sketch 038: Resultados as a Persistent Library / History

## Design Question
The activity rail (033-B) lists **Editor · Cola · Resultados** as three persistent destinations. But
**Resultados was only ever drawn as the post-render *takeover moment*** (024-B: "the finished reel lands
here, big and playable"). Click "Resultados" from the rail when you *haven't* just rendered, and there's
no sketch for what's there. For a **repeat-use / batch tool** with a real `output/` directory, the honest
answer is: **your past reels** — a browsable library/history. This surface is the rail's unkept promise.

⚠️ **Frontier / scope-expanding** beyond Phase 22 look-polish — but the rail creates the expectation, so
the shape should be settled.

Grounded in real output: MP4 filenames, 1080×1920, durations, sizes, and the **per-platform metadata**
(026-C: TikTok / Reels / Shorts) gathered at render time. **Re-render is single-job** (the OOM
constraint). **Download uses accent, not green.** The only green on the whole surface is the **empty
state's "Ir al editor →"** CTA, because that's the one action that initiates the render flow.

## How to View
open .planning/sketches/038-resultados-library/index.html

Each variant has a **"ver vacío"** toggle (top-right) to see the first-run empty state before any reel
exists. Hover cards/rows to reveal per-item actions.

## Variants
- **A: Uniform gallery grid** — a grid of identical 9:16 thumbnail cards, hover→play / download /
  re-render. The familiar, naive answer. *(Deliberately the baseline: it's the "identical card grid"
  SaaS cliché — nothing distinguishes the latest reel, and uniform cards read as monotony.)*
- **B: File-manager list** — one dense row per reel: real filename · title · date · duration · size ·
  per-platform "ready" badges · hover actions (play / download / re-render / locate). Honest that this
  *is* the `output/` folder; scannable, management-forward, varied rhythm.
- **C: Featured latest + history** — the most-recent reel **big and playable** (the 024-B takeover as the
  default landing, "● Recién renderizado") over a **dense history list** of the older ones. Bridges the
  post-render *moment* and the durable *library*; varies spacing for rhythm.

## What to Look For
- **Does it bridge the takeover (024-B) and the library?** C explicitly does — the freshly-rendered reel
  is the hero (so arriving here right after a render still feels like 024-B), while older reels collapse
  to a list. A and B treat every reel equally; C honors recency. Which matches how you'd actually use it?
- **Monotony vs scan-ability:** A's uniform grid is pretty but flat (and trips the "identical card grid"
  anti-pattern); B's list is denser and more honest about being a file directory; C varies the rhythm.
- Is the **per-platform metadata** (TikTok/Reels/Shorts ready-badges) legible as "publish-ready state"
  carried over from 026-C, or noise in a browse surface?
- **Single-job honesty:** re-render here re-enters the one-at-a-time pipeline — should the action warn,
  or is the constraint better surfaced in the queue (030)?
- **Green discipline:** the only green is the *empty-state* CTA (it routes to the render flow); every
  per-reel action (download / play / re-render) is accent or outline. Confirm no populated row greens.
- The **empty state** ("Todavía no renderizaste ningún reel") — does it teach what the destination is
  *for* without a welcome-takeover, the way 017-B framed the editor cold start?
