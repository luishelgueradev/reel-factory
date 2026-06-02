---
sketch: 036
name: command-palette
question: "The reference bar is Linear / Figma / Raycast and the register is 'the tool disappears into the task' — that idiom is keyboard-driven, but no sketch has felt the keyboard layer: ⌘K palette · jump-to-tab · apply-preset · run · open-queue. Palette, palette+cheatsheet, or direct bindings?"
winner: "A"
tags: [frontier, keyboard, command-palette, power-user, raycast]
---

# Sketch 036: Command Palette / Keyboard Model

## Design Question
The whole design direction names **Linear / Figma / Raycast** as the craft bar and "the tool disappears into the task" as the register. That idiom is keyboard-first, but every sketch so far has been pointer-driven. What is the keyboard layer for this dense panel? A discoverable **⌘K command palette** (search every action, jump to any tab, apply a preset, render, open the queue / settings)? The palette plus a learnable **cheat sheet**? Or **direct bindings only** for a focused single-purpose tool? The command palette is an explicitly *sanctioned* product pattern (not the banned reach-for-a-modal), so the question is which keyboard model fits a tool used in focused bursts.

## How to View
open .planning/sketches/036-command-palette/index.html

Press **⌘K** (or Ctrl+K) to open the palette; type to fuzzy-filter, ↑↓ to navigate, ↵ to run. In **B** press **?** for the cheat sheet. In **C** press **1**–**4** to switch tabs and **G** then **R** to render (watch the chord cue).

## Variants
- **A: Palette only (⌘K)** — a Raycast-style centered overlay: fuzzy search over grouped commands (Ir a · Acciones · Estilos · Configuración · Ayuda), each row showing its icon, sub-label, and shortcut, with the primary Render command tinted action-green in its icon. The single discoverable entry point to everything. Keyboard-complete (arrows + Enter), pointer-optional.
- **B: Palette + cheat sheet** — the same ⌘K palette, plus a **?** overlay that maps every binding, plus inline `kbd` hints on header buttons and tab numbers. Tests whether the palette alone teaches itself or wants an explicit reference card for users graduating to direct bindings.
- **C: Direct bindings only (no overlay)** — no palette. Single keys switch tabs (1–4); chords run actions (**G**→**R** render, **G**→**E** apply style, **G**→**F** font), with a persistent ambient hint card and inline `kbd` badges on buttons. The vim-register take: fastest for a memorized tool, nothing to open, but a steep cold-start with no discovery surface.

## What to Look For
- Does the palette feel like the **Raycast/Linear idiom** users already trust (fuzzy match, grouping, shortcut hints, keyboard-complete), or like a bolted-on search box?
- A vs B: is the palette **self-teaching** enough that a separate cheat sheet is redundant, or does a focused tool benefit from an explicit, memorizable map (B) that graduates users from palette → direct keys?
- C: for a **single-purpose tool opened in bursts**, are direct bindings + an ambient hint card faster, or does the lack of a discovery surface make it unlearnable for the occasional user? Does the **G-chord cue** make chords feel guided rather than arcane?
- Is the command set **honest** (it only lists actions that exist elsewhere in the app: tabs, render, presets 034, queue 030, settings 032, fonts 016) rather than inventing palette-only powers?
- **Green discipline:** Render is the only action that carries green (just its palette icon tint + the header button); no command row or chord cue turns green.
