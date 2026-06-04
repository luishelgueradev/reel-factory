// config-resolution.test.ts — resolveConfigPathWith resolution order (Phase 24 robustness)
// Proves a stale/missing job-scoped PIPELINE_CONFIG_PATH falls back to the active config
// instead of bare defaults, so applied profiles + saved active config stay visible.
process.env.NODE_ENV = "test"; // prevent server.listen() on import
process.env.API_SERVER_URL = "http://mock-api-server:3000";

import { describe, it, expect } from "vitest";
import { resolveConfigPathWith } from "./server.js";

const yes = () => true;
const no = () => false;
const existsOnly = (target: string) => (p: string) => p === target;

describe("resolveConfigPathWith — resolution order", () => {
  it("uses the job-scoped path when its file exists (D-19 precedence)", () => {
    const r = resolveConfigPathWith({
      pipelineConfigPath: "/data/pipeline/job1/remotion-renderer/pipeline-config.json",
      activePath: "/data/pipeline/pipeline-config.json",
      fileExists: yes,
    });
    expect(r).toBe("/data/pipeline/job1/remotion-renderer/pipeline-config.json");
  });

  it("falls back to the ACTIVE config when the job path is set but MISSING (the fix)", () => {
    const active = "/data/pipeline/pipeline-config.json";
    const r = resolveConfigPathWith({
      pipelineConfigPath: "/data/pipeline/stale-job/remotion-renderer/pipeline-config.json",
      activePath: active,
      fileExists: existsOnly(active), // only the active file exists
    });
    expect(r).toBe(active);
  });

  it("derives from INPUT_PATH when that derived file exists and no job path", () => {
    const derived = "/data/pipeline/jobX/remotion-renderer/pipeline-config.json";
    const r = resolveConfigPathWith({
      inputPath: "/data/pipeline/jobX/remotion-renderer/output.mp4",
      activePath: "/data/pipeline/pipeline-config.json",
      fileExists: existsOnly(derived),
    });
    expect(r).toBe(derived);
  });

  it("prefers ACTIVE over a missing INPUT-derived path", () => {
    const active = "/data/pipeline/pipeline-config.json";
    const r = resolveConfigPathWith({
      inputPath: "/data/pipeline/jobX/remotion-renderer/output.mp4",
      activePath: active,
      fileExists: no, // nothing exists
    });
    expect(r).toBe(active);
  });

  it("falls back to cwd/pipeline-config.json when nothing is configured", () => {
    const r = resolveConfigPathWith({ fileExists: no, cwd: "/work" });
    expect(r).toBe("/work/pipeline-config.json");
  });
});
