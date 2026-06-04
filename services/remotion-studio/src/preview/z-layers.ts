/**
 * z-layers.ts — Shared z-index ladder for all layered surfaces in the Studio.
 *
 * Sketch reference: 041 modal-stack-choreography
 * Design law: surfaces must stack in this strict order to prevent any sheet
 * (popover, drawer) from punching through a takeover or toast.
 *
 * Ladder (ascending stacking order):
 *   base     0  — in-flow content, player, stage background
 *   sheet   20  — popovers, dropdowns, inline drawers (ProfilesMenu, ...)
 *   takeover 30 — full-stage overlays that sit above sheets
 *   palette 40  — command palette (future); sits above takeovers
 *   toast   60  — transient notification toasts; always on top
 *
 * Usage:
 *   import { Z } from "../preview/z-layers.js";
 *   zIndex: Z.sheet    // popover
 *   zIndex: Z.takeover // render progress / success / failure overlays
 *   zIndex: Z.toast    // notification toasts
 */
export const Z = {
  base: 0,
  sheet: 20,
  takeover: 30,
  palette: 40,
  toast: 60,
} as const;

export type ZLayer = keyof typeof Z;
export type ZValue = (typeof Z)[ZLayer];
