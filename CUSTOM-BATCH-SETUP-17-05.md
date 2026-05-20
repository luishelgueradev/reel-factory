# Custom Batch Setup v2 — 2025-05-17 — Sentence Layout Sync Fix

## Bug Fix

Fixed sentence layout word sync: `SentencePageForLayout` was using absolute timestamps
instead of sequence-relative frames. Added `pageFromFrame` prop to offset timestamps
inside `<Sequence>`, matching `TikTokLayout`'s approach.

## Style Changes from v1

| Change | v1 (before) | v2 (after) | Reason |
|--------|-------------|------------|--------|
| fontWeight | 800 active / 700 past | 700 constant | Weight changes caused letter shifting |
| Past words | same opacity as future words | 50% opacity | Visual hierarchy: past < future < active |
| Word padding | 2px | 4px | Words too close together in some fonts |
| Font rendering | default | geometricPrecision + antialiased | Sharper text rendering |
| Word sync | absolute frame timestamps | relative to Sequence offset | Fixed desync on sentences 2+ |

## Pipeline Configuration per Video

| Parameter | Value |
|-----------|-------|
| **Layout** | `sentence` — muestra una oracion completa, solo la palabra actual en `activeColor`, pasadas al 50% de opacidad, futuras en `inactiveColor` (#FFFFFF) |
| **fontSize** | 45 |
| **fontWeight** | 700 (constante, no cambia entre active/inactive) |
| **letterSpacing** | 0 |
| **lineHeight** | 1.4 |
| **activeColor** | varia por video (ver tabla) |
| **inactiveColor** | #FFFFFF (default) |
| **outlineColor** | #000000 (default) |
| **outlineWidth** | 3 (default) |
| **position** | bottom-center (default) |
| **bottomOffset** | 250 (default) |
| **backgroundHighlight** | `{"enabled": true, "color": "rgba(0,0,0,0.6)", "padding": 8, "borderRadius": 8}` |
| **fadeIn** | 100ms |
| **fadeOut** | 300ms |
| **textRendering** | geometricPrecision |
| **fontSmoothing** | antialiased |

## Visual States for Words

| State | Color | Opacity | fontWeight |
|-------|-------|---------|------------|
| Active (currently spoken) | activeColor | 1.0 | 700 |
| Past (already spoken) | inactiveColor (#FFFFFF) | 0.5 | 700 |
| Future (not yet spoken) | inactiveColor (#FFFFFF) | 1.0 | 700 |

## Variant Table

| # | Video | Font | ActiveColor |
|---|-------|------|-------------|
| 1 | video-1 | Poppins | #FFFF00 |
| 2 | video-2 | Montserrat | #84e634 |
| 3 | video-3 | Inter | #cff56a |
| 4 | video-4 | Roboto | #FF6B6B |
| 5 | video-5 | Oswald | #4ECDC4 |
| 6 | video-6 | BebasNeue | #FF8C42 |
| 7 | video-7 | Antonio | #A855F7 |
| 8 | video-8 | Raleway | #38BDF8 |
| 9 | video-9 | Ubuntu | #F472B6 |
| 10 | video-10 | Nunito | #34D399 |
| 11 | video-11 | SpaceGrotesk | #FB923C |
| 12 | video-12 | Rubik | #818CF8 |
| 13 | video-13 | SourceSans3 | #FBBF24 |
| 14 | video-14 | Outfit | #2DD4BF |
| 15 | video-15 | PlayfairDisplay | #E879F9 |
| 16 | video-16 | LexendDeca | #60A5FA |
| 17 | video-17 | Signika | #F87171 |
| 18 | video-18 | Lato | #4ADE80 |

## Available Fonts

Inter, Roboto, Montserrat, Oswald, Poppins, BebasNeue, Antonio, Raleway, Ubuntu, Nunito, SpaceGrotesk, Rubik, SourceSans3, Outfit, PlayfairDisplay, LexendDeca, Signika, Lato

## Tunable Parameters for Future Tests

| Parameter | Type | Options/Range | Current |
|-----------|------|---------------|---------|
| `layout` | string | tiktok / sentence / bar / karaoke | sentence |
| `fontFamily` | string | 18 fonts (see above) | varies |
| `fontSize` | number | any | 45 |
| `fontWeight` | number | 100-900 | 700 (constant) |
| `letterSpacing` | number | any (negative = condensed) | 0 |
| `lineHeight` | number | >1 = more spacing | 1.4 |
| `activeColor` | string | any hex/rgba | varies |
| `inactiveColor` | string | any hex/rgba | #FFFFFF |
| `pastWordOpacity` | number | 0-1 | 0.5 |
| `backgroundHighlight.enabled` | boolean | true / false | true |
| `backgroundHighlight.color` | string | any hex/rgba | rgba(0,0,0,0.6) |
| `backgroundHighlight.padding` | number | px | 8 |
| `backgroundHighlight.borderRadius` | number | px | 8 |
| `outlineColor` | string | any hex/rgba | #000000 |
| `outlineWidth` | number | px | 3 |
| `position` | string | bottom-center / top-center / center-screen | bottom-center |
| `bottomOffset` | number | px from bottom | 250 |
| `fadeIn` | number | ms | 100 |
| `fadeOut` | number | ms | 300 |
| `textRendering` | string | geometricPrecision / optimizeLegibility / auto | geometricPrecision |
| `wordPadding` | string | CSS padding | 0 4px |

## Script

`./scripts/custom-batch.sh` — runs all 18 variants through the 5-step pipeline (Whisper → Silence Cutter → FFmpeg Finalizer → Remotion Renderer → SRT/VTT Export)