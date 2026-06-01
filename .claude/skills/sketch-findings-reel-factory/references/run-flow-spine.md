# Pipeline Run-Flow Spine — How Render, Inspection, Results & Queue Compose

Four winners were each sketched **in isolation** and made *contradicting* navigation choices that
were never drawn together:

- **010-A (render):** render runs *inline on the dimmed preview* — **"no modal."**
- **028-B / 029-B (inspection):** transcript & silence-cut review are **full-screen takeovers** with a
  shared **step-rail** (Audio→Transcripción→Silencios→Render) and a **"Confirmar … →"** gate.
- **024-B (last-mile):** results is *another* **full-screen takeover**.
- **030-A (queue):** navigation is an **Editor⇄Cola** header switch — a third model.

Sketch 031 is the **integration sketch** that reconciles them into one spine. The whole question
reduces to a single axis: **is inspection a PULL (opt-in off an inline run) or a PUSH (forced gates in
a takeover wizard)?** The core value promises *"revisar salidas intermedias antes de continuar"* — so
inspection must be *possible*, but forcing it on every render is heavy.

⚠️ **Scope-expanding / integration finding.** This is the navigation contract the render+inspection
surfaces hang off — it depends on 010 / 028 / 029 / 024 / 030, all themselves scope-expanding past the
Phase 22 editor shell. The spine is settled; build it when those surfaces land.

## Design Decisions

### Winner 031-A — Inline-first, review = PULL
**010-A stays the spine.** Render dims the stage and the 3-step pipeline runs *in the editor* — no
wizard, no app-mode change. The run stays **inside the editor** so the **Editor⇄Cola switch (030)
persists** and "I'm mid-render" reads honestly without a separate screen. Inspection is a **pull**:
each reviewable step **soft-pauses with a 3s auto-continue + a "Revisar" affordance** that opens
028/029 *only on demand*. Lands on a **small in-stage results card**; the big 024-B results takeover
opens **only if you ask** ("Abrir resultado →"). This keeps render **fast for a trusted clip** while
still honoring the inspectability promise.

### Why pull beat push (and beat the toggle)
- **B — gated wizard (review = push):** Render *enters* a full-screen takeover; the step-rail becomes
  the primary chrome and **replaces** the Editor⇄Cola switch; **hard "Confirmar →" gates** at
  Transcripción & Silencios (028/029 literally *are* the steps). Makes "inspeccionable" the default —
  but **every render becomes a multi-click wizard**, too heavy a tax on a trusted clip. Rejected as the
  default; its takeover chrome survives as *what a pulled review looks like*.
- **C — hybrid (per-render toggle):** a single "Revisar cada paso" switch next to Render picks the
  rigor (OFF = A's inline soft run, ON = B's gated takeover). The tidy synthesis — but it **defers the
  decision** to the user on every render instead of the product making one. Rejected.

### Single-job / batch coherence is what makes A *correct*, not just lighter
A models the single-job truth (030) exactly: a **queued batch runs auto** (you can't sit and gate each
job), and you only ever gate the **one foreground job you're driving**. A forced wizard (B) is
incoherent with a batch — you can't wizard 8 queued videos. The pull is the only model that's honest
across both single-render and batch.

### Green discipline extends into the flow
Render is green at **idle**. *Inside* the flow the only green is the **"Confirmar →" / "Continuar"**
gate. Never two greens at once — the same rule from `header-action-zone.md` / `states-and-save-feedback.md`,
now carried through the run. The status chip carries `dirty → Procesando… → ✓ Reel listo`; the
cancel/exit/skip actions stay neutral.

### Build calibration — the soft countdown
The **3s auto-continue** is a *placeholder beat to validate against real latency*. If a Whisper/cut
step takes 8s, the **"Revisar" pull must stay available for the whole step**, not just a 3s window
after it completes. Don't ship the literal 3s timer without checking it against real
`faster-whisper` + `silence-cutter` timings — a too-short window makes the pull feel anxious / unreachable.

## CSS / State Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The flow state machine (the spine itself)
One engine drives all three variants — the difference is two flags: `mode` (`soft` auto-advance vs
`hard` block-on-confirm) and `chrome` (`inline` dimmed-stage vs `takeover` full-screen). A is
`{mode:'soft', chrome:'inline'}`.

```js
// shared step model — Audio is instant/pre; the 3 real steps drive the progress bar
const STEPS = [
  { key:'audio',         label:'Audio',         review:false, instant:true },
  { key:'transcripcion', label:'Transcripción', review:true  },   // → 028 review
  { key:'silencios',     label:'Silencios',     review:true  },   // → 029 review
  { key:'render',        label:'Render',        review:false },
];
// phases: idle → running → gate → (review) → running → … → done
// soft gate: enterGate() starts a 3s countdown that auto-advance()s; "Revisar" opens the pull.
// hard gate: enterGate() waits for the "Confirmar →" click (no timer).
```

### Inline run overlay (010-A spine) — dim the stage, don't modal
```css
.stagecol.dim .stage9x16 { filter: brightness(0.32) saturate(0.5); }      /* dim, not replace */
.runover { position:absolute; inset:0; display:none; flex-direction:column;
           align-items:center; justify-content:center; gap:var(--s-8); animation:fadein .25s var(--ease); }
.runover.show { display:flex; }
.ring { width:92px; height:92px; }   .ring svg { transform:rotate(-90deg); }  /* progress ring */
```
The progress ring + a **vertical mini-pipeline** (`.pvert`/`.pvrow`) sit *over the dimmed stage* — the
editor is still right there behind it.

### The soft gate card — the PULL affordance (the heart of A)
A completed reviewable step shows a small card on the dimmed stage: a countdown to auto-continue **and**
an opt-in review button. This is what makes inspection a pull.
```html
<div class="gatecard">
  <div class="gt"><span class="ok">✓</span>Transcripción lista</div>
  <div class="gd">Seguimos con <b>Silencios</b> <span class="countdown">en 3s…</span>
       — o revisá antes de continuar.</div>
  <div class="row">
    <button class="btn btn-out"   onclick="review('transcripcion')">Revisar transcripción</button>
    <button class="btn btn-green" onclick="advance()">Continuar →</button>   <!-- the one green -->
  </div>
</div>
```
Done steps keep a persistent `Revisar` pull chip (`.revlink`, accent pill) in the mini-pipeline so you
can still open review after auto-continue moved on.

### The in-stage results card (A) vs the 024-B takeover (opt-in)
A lands small and **in the editor** — the big results screen is a click away, never forced:
```html
<div class="results small">
  <div class="reel"></div>
  <div class="rmeta"><h2>✓ Reel listo</h2>
    <div class="filecard">reel-3-trucos.mp4 · 1:14</div>
    <button class="btn btn-green">Abrir resultado →</button>   <!-- opens 024-B takeover -->
    <button class="btn btn-out">⤓</button></div>
</div>
```
`.results.small .reel { width:130px; height:231px }` vs `.results.big .reel { width:280px; height:498px }`
— same component, two scales. The takeover reuses the step-rail header + `tk-body`/`tk-foot` chrome that
028/029 already established.

### Editor⇄Cola switch dims but persists during an inline run
```css
.vswitch.dim { opacity:0.4; pointer-events:none; }   /* present mid-render, just not actionable */
```
In B's wizard the switch is *removed* (the takeover replaces it) — the tell that B changes app-mode
where A doesn't.

## What to Avoid
- **Don't force a review wizard on every render (031-B as the default).** It's the right *chrome* for a
  pulled review but the wrong *default* — it taxes every trusted clip with multi-click gates.
- **Don't push inspection as a hard gate on a batch.** You can't sit and confirm 8 queued jobs — a
  batch from the Cola **runs auto**; only the one foreground job you're driving is gateable (030).
- **Don't change app-mode to render.** Keep the run inline so the Editor⇄Cola switch persists and
  "mid-render" reads in place — don't swap the whole screen for a wizard (the B tell).
- **Don't ship the literal 3s countdown unchecked.** Calibrate the soft-pause window to real
  Whisper/cut latency; keep the "Revisar" pull reachable for the *whole* step, not a fixed 3s.
- **Don't put a second green in the flow.** Render(idle) → Confirmar/Continuar(gate) is the single
  green at each moment; cancel/skip/exit stay neutral.
- **Don't defer the decision to a per-render toggle (031-C).** The product picks pull; the toggle just
  reintroduces the question on every render.

## Origin
Synthesized from sketch 031 (pipeline-run-flow-spine, winner **A** — inline-first / review = pull; B =
forced gated wizard, C = per-render rigor toggle). The integration sketch that composes the previously
isolated winners 010-A (render), 028-B/029-B (inspection, see `pipeline-inspection.md`), 024-B
(results, see `render-last-mile.md`), and 030-A (queue, see `batch-queue.md`) into one navigation
spine. Source file in `sources/031-pipeline-run-flow-spine/` (winner `#v-a`) — **playable**; press
▶ Render in each variant to feel where the friction lands.
