---
sketch: 025
name: caption-animation-preview
question: "Every specimen (011/014) was static, but the word-by-word highlight motion is what the reels are for. Does the preview play the caption animation, and where does the playback / scrub control for it live?"
winner: "C"
tags: [frontier, subtitles, animation, preview, playback, temporal, phase-22]
---

# Sketch 025: Caption Animation Preview

## Design Question
The defining feature of these reels is the **word-by-word highlight** — the TikTok-style caption that
pops each word as it's spoken. Yet every prior subtitle sketch (011, 014, 012) previewed it as a
**static specimen**: a frozen frame of styled text. You can't judge the *rhythm* of the highlight from
a still. So: **does the preview actually play the caption animation, and where does its playback /
scrub control live?** This is the motion the whole tool produces — it deserves to be felt while you
style it.

## How to View
open .planning/sketches/025-caption-animation-preview/index.html

(All three variants animate live — open it in a browser, don't just read the markup.)

## Variants
- **A: Specimen plays (loop)** — the in-panel specimen runs the word-by-word highlight on a continuous
  loop with a ▶/❚❚ toggle and a speed control. The stage shows a static frame. Style and rhythm judged
  *in the panel*, nothing else to operate.
- **B: The preview drives it (transport)** — the real phone preview plays the animation, driven by a
  transport (play + scrub + clock) under the stage — the same idiom as the 020 timeline. The specimen
  drops to a static *style* reference. One source of truth for time.
- **C ★: Loop + transport (division of labor)** — the specimen loops the *style* (judge the highlight
  rhythm freely), while the stage transport scrubs the *real moment* in the video. Mirrors the 022-B +
  020-C split: each surface does one job. Watch for whether two simultaneous animations compete.

## What to Look For
- Switch modes (TikTok / Barra / Frase / Karaoke) **while it animates** — does the motion make the
  mode difference obvious in a way the static specimen never could?
- In A, drag the **Velocidad** slider — does looping the specimen make rhythm tuning feel direct?
- In B, **scrub** the stage transport — does word-by-word scrubbing on the real preview feel like the
  honest preview, worth losing the in-panel motion for?
- In C, look at both at once — does the loop-vs-scrub division read as complementary, or as two things
  fighting for your eye? (This is the key risk for the synthesis.)
- Which surface do you instinctively trust to answer "will this caption feel good in the final reel?"

## Outcome — Winner: C (loop + transport, division of labor)
The word-by-word motion gets **two complementary surfaces**: the in-panel specimen loops the *style*
(judge highlight rhythm freely) while the stage transport scrubs the *real moment* — mirroring the
020-C / 022-B "global places, local refines" split. The competing-motion risk was judged acceptable:
the two animations answer different questions and don't fight when you're focused on one. Static
specimens (011/014) are retired for subtitles — the preview now plays.
