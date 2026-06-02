# Background Render / Batch Notifications — How Completion Reaches You Off-Stage

The run-flow spine (031) keeps the **foreground** render inline on the dimmed stage, where you watch it.
But the queue (030) runs **other** jobs while you edit the next clip or browse elsewhere. When a
**queued render completes** — or **OOM-fails** (the real, honest constraint) — and you're *not* on the
stage, how does that reach you? Sketch 035 is the connective tissue between the queue (030), the spine
(031), and the results takeover (024-B).

The honest framing matters: single-job-foreground renders **you're usually watching** (031), so
notifications earn their keep mainly for **batch / queued** completions. The signal must carry success,
the **OOM failure plainly**, and a **batch summary** — without inventing a noisy channel for a
single-purpose local tool.

⚠️ **Frontier / async-ops.** Beyond Phase 22 look-polish; settles *how async completion surfaces* so the
real build has the pattern when the queue is wired.

## Design Decisions

### Winner 035-D — synthesis: toast (the moment) + Cola-badge tally (the durable record)
Neither ephemeral nor heavyweight alone — **both, each doing its honest job**:
- **A's transient toast covers *the moment*** — a bottom-right snackbar appears when a job finishes.
  **Success auto-dismisses (~5s)** with Abrir / ⤓ Descargar links; the **OOM failure persists** (never
  auto-dismisses — you must act or dismiss it) with Reintentar / Ver en la cola.
- **C's Cola-badge tally is *the durable record*** — the Editor⇄Cola switch badge grows a
  `✓3 ✕1` count that **survives after the toast is gone**. Nothing ephemeral is truly lost: the badge is
  the **persistent truth**, the toast is the **courtesy**.
- **Zero new header chrome** — no bell. B's full notification center stays **in reserve** for *if batch
  volume ever justifies* a durable, reviewable log.

Why the synthesis wins over each pure variant:
- **vs A alone (toast only):** transient — miss it and it's gone. The Cola badge is the fallback record
  that makes "miss the toast" non-fatal.
- **vs B alone (bell + center):** a 🔔 with unread count and a dropdown log is **durable and reviewable**,
  but costs **one more header control** and a bell **reads as "enterprise app"** if overused — wrong
  register for a tool you open per-session, not all day. Held in reserve, not shipped.
- **vs C alone (queue carries it):** the most honest with the single-job/batch reality and **adds zero
  chrome**, but it's **quiet** — easy to miss if you never glance at the switch. D keeps C's honest badge
  *and* adds A's toast so the immediate moment isn't silent.

### The OOM failure must be calm, specific, and persistent
The real failure mode is **single-job / Chrome-headless RAM exhaustion (OOM)** — not a generic error.
Every failure notification:
- **persists** (never auto-dismisses) — a failure you didn't see is worse than a success you missed,
- **names the real cause plainly** — *"sin memoria (OOM). Chrome headless agotó la RAM."* — honest about
  the `MAX_CONCURRENT_JOBS=1` constraint (see `batch-queue.md`), not alarmist,
- **always offers Reintentar + Ver en la cola**,
- uses **`--danger`** for the icon only (low-chroma, calm), never a full red banner.

This is the same honesty the queue's concurrency banner carries: state the one-video-at-a-time limit
plainly rather than hide or apologize for it.

### Green discipline (strict here)
- **Success uses `--success`** (the confirm green), **not** the reserved `--action` render-green.
- **Every action link** — Abrir / ⤓ Descargar / Reintentar / Ver en la cola — uses **accent (blue)**.
- The reserved **action-green never appears in a notification**. (Render-green is for *initiating* the
  one primary action of a surface; a notification initiates nothing primary.)

### The badge tally is the source of truth
The Cola switch badge transitions: `● 1` (one queued, idle) → `✓3 ✕1` (tally after jobs resolve). It's
the **persistent record** the toast defers to. A small flash on the switch when the tally changes draws
the eye without a new channel.

## CSS / HTML Patterns

All patterns use the shared tokens in `sources/themes/default.css`.

### The toast stack (A / D) — success auto-dismisses, OOM persists
```css
.toaster   { position:fixed; right:var(--s-10); bottom:var(--s-10); width:320px;
             display:flex; flex-direction:column; gap:var(--s-5); z-index:200; }
.toast     { background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--r-md);
             box-shadow:var(--shadow-pop); padding:var(--s-6) var(--s-8); display:flex; gap:var(--s-5);
             align-items:flex-start; animation:toastin .26s var(--ease); }
.toast.leaving { animation:toastout .3s var(--ease) forwards; }
.toast .ic     { width:26px; height:26px; border-radius:var(--r-sm); display:grid; place-items:center;
                 flex:none; font-size:13px; font-weight:700; }
.toast.ok  .ic { background:oklch(0.72 0.14 150 / 0.18); color:var(--success); }   /* success = --success, not action-green */
.toast.err .ic { background:oklch(0.63 0.185 25 / 0.18); color:var(--danger); }     /* OOM = --danger, calm */
.toast .ta     { display:flex; gap:var(--s-6); margin-top:var(--s-5); font-size:var(--t-xs); }
.linkacc       { color:var(--accent); font-weight:600; cursor:pointer; }            /* every action link = accent */
```
```js
@keyframes toastout { to { opacity:0; transform:translateX(24px); height:0; margin:0; padding-top:0; padding-bottom:0; } }
// success self-dismisses; the OOM failure does NOT
setTimeout(() => { if (el.isConnected && kind !== 'err') dismiss(el); }, kind === 'err' ? Infinity : 5200);
```

### The Cola-badge tally (C / D) — the durable record
```css
.qbadge       { font-size:var(--t-2xs); border-radius:var(--r-full); padding:0 6px; min-width:16px;
                height:16px; display:inline-flex; align-items:center; justify-content:center; gap:3px; }
.qbadge .ok   { color:var(--success); font-weight:700; }   /* ✓3 */
.qbadge .er   { color:var(--danger);  font-weight:700; }   /* ✕1 */
@keyframes badgepop { 0% { transform:scale(0.6); } 60% { transform:scale(1.15); } 100% { transform:scale(1); } }
```
```js
// the badge survives after the toast is gone — persistent truth vs ephemeral courtesy
function badgeInner(done, err){
  let s = '';
  if (done > 0) s += `<span class="ok">✓${done}</span>`;
  if (err  > 0) s += `${done>0?' ':''}<span class="er">✕${err}</span>`;
  return s || '<span style="color:var(--accent)">●</span>1';   // idle: one queued
}
```

### The bell + center (B) — HELD IN RESERVE, not shipped
Kept in the source for *if batch volume ever justifies a durable reviewable log*. Pattern: a `🔔` icon
button with an animated `.bell-badge` unread count, opening a `.center` dropdown of `.ntf` rows
(unread = `accent-tint-2` background), each with the same icon-role + action-link vocabulary. **Don't
ship it for a per-session tool** — it reads as enterprise overhead.

## What to Avoid
- **Don't auto-dismiss failures.** OOM persists until acted on or dismissed; a missed failure is worse
  than a missed success (which the badge records anyway).
- **Don't show a generic error.** Name the real cause — single-job / Chrome RAM OOM — plainly and calmly;
  always offer Reintentar + Ver en la cola.
- **Don't add a bell for a per-session tool (B as primary).** It costs a header control and reads as
  enterprise; reserve it strictly for if batch volume ever demands a durable log.
- **Don't rely on the queue badge alone (C as primary).** It's honest but quiet; pair it with the toast
  so the immediate moment isn't silent.
- **Don't green a notification.** Success = `--success`; all action links = accent; the reserved
  action-green never appears in a toast, strip, or center.
- **Don't let anything ephemeral be the only record.** The Cola-badge tally is the persistent truth the
  transient toast defers to.

## Origin
Synthesized from sketch 035 (background-notifications, winner **D** — synthesis of A's toast + C's
Cola-badge tally; A = toast-only too transient, B = bell/center held in reserve as enterprise-register,
C = queue-only too quiet). Connective tissue between `batch-queue.md` (030, the OOM/single-job honesty),
`run-flow-spine.md` (031, foreground-watched vs queued-background), and `render-last-mile.md` (024-B,
where "Abrir resultado" lands). Source file in `sources/035-background-notifications/` (winner `#v-d`).
