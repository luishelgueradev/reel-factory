# 22-06 Summary — Human visual sign-off

## What was done

Final human visual verification of Phase 22 on the running Studio (port 3123,
fresh post-Wave-2 build served via the exact AGENTS.md `setsid` command).

- **Task 1 (auto):** `npm run build:editor` exited 0; Studio started on port 3123
  with `EDITOR_DIST=$(pwd)/dist/editor` and `ACTIVE_PIPELINE_CONFIG_PATH` →
  project-root `pipeline/pipeline-config.json`. `curl http://localhost:3123`
  returned **200**.
- **Task 2 (checkpoint:human-verify, blocking):** Human reviewed all 5 ROADMAP
  success criteria in Chrome and signed off with **"approved"**.

## Verification result

Human confirmed all 5 ROADMAP success criteria hold in the live app:

1. 3-column shell (preview · controls · static "Metadata de redes — Próximamente"
   placeholder column with no inputs) — D-01/D-02.
2. Dense, deliberate panel: Posición → Estilo → Avanzado grouping, dark indigo
   theme, blue selection states, single green `Render Video` CTA — D-05/D-06/D-11.
3. Tabs read Títulos | Overlays | Subtítulos (no "Text" tab); sample text atop
   Subtítulos drives the live preview — D-10.
4. Overlay back/front layering via the Capa control renders correctly behind /
   above text in the live Player, with in-band paint order preserved — D-03/D-04.
5. The shared 9-point PositionPresets reposition titles and overlays (size-aware)
   and the migrated subtitle presets work without regression (3 reachable enum
   cells, other 6 inert) — D-07/D-08/D-09.

No defects reported. Quality bar met.

## Key files

- created: `.planning/phases/22-studio-ui-polish/22-06-SUMMARY.md`
- modified: none (verification-only plan; `files_modified: []`)

## Self-Check: PASSED

- Studio reachable on 3123 (HTTP 200) ✓
- Human sign-off ("approved") on all 5 ROADMAP success criteria ✓
- All locked decisions D-01…D-11 confirmed honored in the live app ✓
