import { describe, it, expect } from "vitest";
import {
  STEP_LABELS,
  stepLabel,
  causeLine,
  isLongStep,
  parseStatusError,
} from "./render-status.js";

describe("STEP_LABELS map", () => {
  it("contains all 6 real pipeline step keys", () => {
    expect(STEP_LABELS).toHaveProperty("whisper");
    expect(STEP_LABELS).toHaveProperty("silence-cutter");
    expect(STEP_LABELS).toHaveProperty("ffmpeg-finalizer");
    expect(STEP_LABELS).toHaveProperty("remotion-renderer");
    expect(STEP_LABELS).toHaveProperty("quality-finalizer");
    expect(STEP_LABELS).toHaveProperty("srt-exporter");
  });

  it("contains queued / completed / timeout keys", () => {
    expect(STEP_LABELS).toHaveProperty("queued");
    expect(STEP_LABELS).toHaveProperty("completed");
    expect(STEP_LABELS).toHaveProperty("timeout");
  });
});

describe("stepLabel()", () => {
  it('maps "whisper" → "Transcribiendo"', () => {
    expect(stepLabel("whisper")).toBe("Transcribiendo");
  });

  it('maps "silence-cutter" → "Cortando silencios"', () => {
    expect(stepLabel("silence-cutter")).toBe("Cortando silencios");
  });

  it('maps "ffmpeg-finalizer" → "Formato vertical 9:16"', () => {
    expect(stepLabel("ffmpeg-finalizer")).toBe("Formato vertical 9:16");
  });

  it('maps "remotion-renderer" → "Renderizando"', () => {
    expect(stepLabel("remotion-renderer")).toBe("Renderizando");
  });

  it('maps "quality-finalizer" → "Afinando calidad"', () => {
    expect(stepLabel("quality-finalizer")).toBe("Afinando calidad");
  });

  it('maps "srt-exporter" → "Exportando subtítulos"', () => {
    expect(stepLabel("srt-exporter")).toBe("Exportando subtítulos");
  });

  it('maps "queued" → "En cola"', () => {
    expect(stepLabel("queued")).toBe("En cola");
  });

  it('maps "completed" → "Listo"', () => {
    expect(stepLabel("completed")).toBe("Listo");
  });

  it('maps "timeout" → "Tiempo agotado"', () => {
    expect(stepLabel("timeout")).toBe("Tiempo agotado");
  });

  it("returns raw input for an unmapped key (no throw)", () => {
    expect(stepLabel("unknown-step-xyz")).toBe("unknown-step-xyz");
    expect(stepLabel("")).toBe("");
  });
});

describe("causeLine()", () => {
  it('exit 137 on remotion-renderer → "remotion-renderer · exit 137 — sin memoria"', () => {
    expect(causeLine("remotion-renderer", 137)).toBe(
      "remotion-renderer · exit 137 — sin memoria"
    );
  });

  it('non-OOM exit code → "remotion-renderer · exit 1" (no "sin memoria")', () => {
    expect(causeLine("remotion-renderer", 1)).toBe("remotion-renderer · exit 1");
  });

  it("exit 2 on whisper → no sin memoria suffix", () => {
    expect(causeLine("whisper", 2)).toBe("whisper · exit 2");
  });

  it('undefined exitCode → step name only (no " · exit" tail)', () => {
    expect(causeLine("remotion-renderer", undefined)).toBe("remotion-renderer");
  });

  it("exit 0 → includes · exit 0 (explicit zero)", () => {
    expect(causeLine("silence-cutter", 0)).toBe("silence-cutter · exit 0");
  });
});

describe("isLongStep()", () => {
  it('returns true for "remotion-renderer"', () => {
    expect(isLongStep("remotion-renderer")).toBe(true);
  });

  it("returns false for all other steps", () => {
    for (const step of [
      "whisper",
      "silence-cutter",
      "ffmpeg-finalizer",
      "quality-finalizer",
      "srt-exporter",
      "queued",
      "completed",
      "timeout",
    ]) {
      expect(isLongStep(step)).toBe(false);
    }
  });
});

describe("parseStatusError()", () => {
  it('extracts step + exitCode from "Step remotion-renderer failed (exit 137): killed"', () => {
    const result = parseStatusError(
      "Step remotion-renderer failed (exit 137): killed"
    );
    expect(result).toEqual({ step: "remotion-renderer", exitCode: 137 });
  });

  it("extracts step + exitCode for non-OOM exit code", () => {
    const result = parseStatusError(
      "Step silence-cutter failed (exit 2): some message"
    );
    expect(result).toEqual({ step: "silence-cutter", exitCode: 2 });
  });

  it("extracts step when no exit code present in string", () => {
    const result = parseStatusError(
      "Step whisper failed: unexpected error"
    );
    // step is extracted, exitCode is undefined when not present
    expect(result.step).toBe("whisper");
    expect(result.exitCode).toBeUndefined();
  });

  it("returns empty object for unrecognized string", () => {
    const result = parseStatusError("completely unrelated error text");
    expect(result.step).toBeUndefined();
    expect(result.exitCode).toBeUndefined();
  });

  it("causeLine produces correct output from parseStatusError result (integration)", () => {
    const { step, exitCode } = parseStatusError(
      "Step remotion-renderer failed (exit 137): killed"
    );
    expect(causeLine(step!, exitCode)).toBe(
      "remotion-renderer · exit 137 — sin memoria"
    );
  });
});
