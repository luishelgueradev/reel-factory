---
sketch: 035
name: background-notifications
question: "With the inline-first spine (031) + queue (030), renders finish while you're elsewhere — how does completion / OOM failure reach you when you're not watching the stage (toast · header bell · the Cola switch itself), honest with single-job-foreground vs queued-batch?"
winner: "D"
tags: [frontier, notifications, async, render, batch, ops]
---

# Sketch 035: Background Render / Batch Notifications

## Design Question
The run-flow spine (031) keeps the foreground render inline on the dimmed stage, where you watch it. But the queue (030) runs *other* jobs while you edit the next clip or browse elsewhere. When a **queued render completes** (or **OOM-fails**, the real constraint), and you're not on the stage, how does that reach you? This is the connective tissue between the queue (030), the spine (031), and the results takeover (024). The honest framing matters: single-job-foreground renders you're usually watching, so notifications earn their keep mainly for **batch / queued** completions. The signal must carry success, the OOM failure plainly, and a batch summary, without inventing a noisy channel for a single-purpose local tool.

## How to View
open .planning/sketches/035-background-notifications/index.html

You're in the Editor with a queued render in the background. Use the dashed **simulation panel** on the stage to make it finish (✓), fail (✕ OOM), or report a batch (3/5).

## Variants
- **A: Toast (ephemeral)** — bottom-right snackbar stack. Success auto-dismisses (~5s) with Abrir / Descargar links; the **OOM failure persists** (you must act or dismiss it) with Reintentar / Ver en cola. The Cola switch badge also ticks up. Immediate and lightweight, but transient: miss it and it's gone (the queue badge is the fallback record).
- **B: Header bell + notification center** — a 🔔 with an unread count opens a dropdown log of recent completions/failures, each with actions. Nothing auto-dismisses; you act on your own time. Better when batch volume is high and you want a durable, reviewable record. Cost: one more header control, and a bell can read as "enterprise app" if overused.
- **C: The Cola switch carries it** — no separate channel. The Editor⇄Cola badge grows a `✓3 ✕1` tally, and a slim **strip slides up** from the bottom when a job finishes (dismissible). The queue *is* the notification surface. The most honest with the single-job/batch reality and adds zero new chrome, but it's quieter: easy to miss if you never glance at the switch.
- **D ★: Synthesis (toast + Cola badge)** — the chosen direction. A's transient **toast covers the moment** (success auto-dismisses, OOM persists, with Abrir / Descargar / Reintentar), while C's **Cola-badge tally is the durable record** (`✓3 ✕1`) that survives after the toast is gone. Nothing ephemeral is truly lost: the badge is the persistent truth, the toast is the courtesy. Zero new header chrome (no bell). B's notification center stays in reserve for if batch volume ever justifies a full log.

## What to Look For
- Is the **OOM failure** legible and calm, never alarmist, and clearly the real constraint (single-job, Chrome RAM) rather than a generic error? It should always offer Reintentar + Ver en cola.
- A vs B: **ephemeral** (act now or it's gone, minimal footprint) vs **durable** (review later, costs a header control). Which fits a tool you open per-session, not all day?
- Does C's "queue is the notification" feel **honest and sufficient**, or too quiet, given you're usually watching the foreground render anyway (031)?
- Could the winner be a **synthesis** — C's queue-badge tally as the persistent truth + A's toast for the single immediate moment, reserving B's center only if batch volume justifies it?
- **Green discipline:** success uses `--success` (not action-green), and every action link (Abrir / Descargar / Reintentar) uses accent. The reserved action-green never appears in a notification.
