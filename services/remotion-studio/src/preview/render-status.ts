/**
 * render-status.ts — Pure mapping functions for render step labels + failure cause lines.
 *
 * Covers RENDER-02 (step→Spanish label) and RENDER-03 (exitCode→cause line) contracts.
 * Zero React / Express / fetch dependencies — unit-testable in isolation.
 *
 * The 6 real pipeline steps come from api-server orchestrator.ts STEPS (verified):
 *   whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter
 *
 * Progress value comes straight from GET /status `progress` (api-server computes
 * `(completedSteps+1)/6*100`). This module does NOT recompute it — it only maps
 * labels and cause lines.
 */

/**
 * Map of pipeline step keys to their Spanish display labels.
 * Keys: all 6 real step names from orchestrator STEPS + queued / completed / timeout.
 */
export const STEP_LABELS: Record<string, string> = {
  queued: "En cola",
  whisper: "Transcribiendo",
  "silence-cutter": "Cortando silencios",
  "ffmpeg-finalizer": "Formato vertical 9:16",
  "remotion-renderer": "Renderizando",
  "quality-finalizer": "Afinando calidad",
  "srt-exporter": "Exportando subtítulos",
  completed: "Listo",
  timeout: "Tiempo agotado",
};

/**
 * Returns the Spanish display label for a pipeline currentStep value.
 * Falls back to the raw input string for any unmapped key (never throws).
 */
export function stepLabel(currentStep: string): string {
  return STEP_LABELS[currentStep] ?? currentStep;
}

/**
 * Formats the failure cause line shown in the inline fault panel.
 *
 * Format: `{step} · exit {code}[ — sin memoria]`
 * - exitCode === 137 (signal 9 / OOM) → appends "— sin memoria"
 * - exitCode undefined → returns step name only (no "· exit" tail)
 *
 * Matches UI-SPEC §4 and RESEARCH Code Examples / D-09.
 */
export function causeLine(step: string, exitCode?: number): string {
  if (exitCode === undefined) {
    return step;
  }
  const oomSuffix = exitCode === 137 ? " — sin memoria" : "";
  return `${step} · exit ${exitCode}${oomSuffix}`;
}

/**
 * Returns true only for "remotion-renderer" — the known long-running step.
 * Drives the UI-SPEC §2 "este paso toma más tiempo" hint + indeterminate shimmer.
 */
export function isLongStep(step: string): boolean {
  return step === "remotion-renderer";
}

/**
 * Extracts step name and exit code from the api-server `/status` error STRING.
 *
 * The api-server encodes the failure as a string:
 *   "Step {step} failed (exit {code}): {message}"
 * while POST /process failure bodies carry a structured { step, exitCode, message }.
 *
 * This helper bridges the two shapes so the UI can feed both into causeLine().
 *
 * Returns { step?, exitCode? } — both fields are optional because the string may
 * not match the expected pattern.
 */
export function parseStatusError(errStr: string): {
  step?: string;
  exitCode?: number;
} {
  // Match: "Step <step-name> failed (exit <code>): <message>"
  const withCode =
    /^Step\s+([a-z][a-z0-9-]*)\s+failed\s+\(exit\s+(\d+)\)/i.exec(errStr);
  if (withCode) {
    return {
      step: withCode[1],
      exitCode: parseInt(withCode[2], 10),
    };
  }

  // Match: "Step <step-name> failed: <message>" (no exit code)
  const noCode = /^Step\s+([a-z][a-z0-9-]*)\s+failed/i.exec(errStr);
  if (noCode) {
    return { step: noCode[1] };
  }

  return {};
}
