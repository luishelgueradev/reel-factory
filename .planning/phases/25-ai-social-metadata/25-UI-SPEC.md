---
phase: 25-ai-social-metadata
type: ui-spec
requirements: [META-01, META-02, META-03, META-04]
tokens_source: existing OKLCH design tokens (--action, --accent, --danger, --t-*, --s-*, --r-*, --ease, --dur)
mandatory_tooling: "impeccable skill + frontend-design plugin (AGENTS.md) + sketch-findings-reel-factory (AI metadata column)"
---

# Phase 25 — UI design contract: AI social metadata panel

## Where it lives
**Column 3** of the Studio (the 320px panel that Phase 22 shipped as the static
"Metadata de redes — Próximamente" placeholder, PreviewApp.tsx ~L887-932). Replace the
placeholder card with the live panel. Reference: sketch-findings `AI metadata column`.

## Panel anatomy (top → bottom)
1. **Header:** "Metadata de redes" + a small backend chip when generated (e.g. "gpt-oss" / "qwen", from `_meta.backend`).
2. **Controls row:** a **Plataforma** selector (TikTok / Instagram Reels / YouTube Shorts) and a **Tono** selector (Cercano / Profesional / Llamativo). Compact segmented controls or selects, `--accent` for the active option.
3. **Primary action:** **"✨ Generar metadata"** (becomes **"↻ Regenerar"** once a result exists). Uses `--accent` — NOT `--action` (green stays reserved for Render / Guardar config). Disabled with a muted hint ("Generá un render primero") until a completed render jobId exists (D-02).
4. **Result fields** (each a labeled block with inline edit + a copy button):
   - **Título** — single-line editable; per-field **copy** (📋). (META-02, META-03)
   - **Descripción** — multi-line textarea, editable; per-field copy.
   - **Hashtags** — rendered as chips; editable (as text, re-parsed) ; copy-all (space/newline-joined).
5. **States:**
   - **Empty (no render yet):** muted "Generá un render para crear la metadata."
   - **Ready (render done, not generated):** the Generar button enabled; fields empty/placeholder.
   - **Generating:** button → spinner + "Generando…" ; fields show a calm shimmer; controls disabled. (cloud can take a few seconds — design for ~5s)
   - **Generated:** fields populated, editable, copyable; "✓ Copiado" transient chip on copy (mirror the existing "✓ Guardado" chip pattern).
   - **Error:** inline low-chroma `--danger` line with the cause (e.g. "Router no disponible" / "Sin API key configurada") + a Reintentar; never blocks anything else.

## Behavior
- **Generate/Regenerate** → `POST /api/metadata { jobId, platform, tone }`; on success populate fields (+ persist per D-05); regenerate overwrites the current result.
- **Inline edit** updates local UI state only (does not auto-call the model); edits persist to `metadata.json` on an explicit save or next regenerate (planning decides exact trigger; at minimum edits survive within the session).
- **Per-field copy** writes that field to the clipboard independently (META-03).
- **Tone/Platform change** does NOT auto-regenerate; the user changes them then clicks Regenerar (avoids surprise cloud calls).

## Visual discipline (impeccable / frontend-design)
- **Green discipline:** exactly one `--action` green on screen (Render / Guardar config). The metadata panel uses `--accent` (primary affordance) + `--danger` (errors only). No second green.
- Tokens only (`--s-*`, `--t-*`, `--r-*`, `--ease`, `--dur`); no improvised px/colors. Motion respects `prefers-reduced-motion`.
- Fits the 320px column without horizontal overflow; description textarea scrolls; hashtag chips wrap.
- Keyboard accessible: selectors, generate button, each field + copy reachable by Tab; copy gives visible feedback.

## Acceptance (visual)
- Panel reads as a natural evolution of the Phase 22 placeholder (same column, same card language).
- Single green on screen at all times.
- Empty / ready / generating / generated / error states all designed (no raw/unstyled states).
- Title/description/hashtags clearly distinct, each independently editable + copyable.
