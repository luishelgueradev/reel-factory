import Dockerode from "dockerode";
import fs from "fs/promises";
import path from "path";
import { PIPELINE_DATA_DIR, PIPELINE_NETWORK, HOST_PIPELINE_DIR } from "./constants.js";
import type { PipelineManifest } from "../../shared/schemas/manifest.js";

/**
 * Pipeline step configuration matching docker-compose.yml service definitions.
 * Each step specifies the Docker image name, environment variables, and
 * any step dependency (used for healthcheck/ordering).
 */
export interface PipelineStepConfig {
  name: string;
  image: string;
  envVars: Record<string, string>;
  waitForStep?: string; // depends_on in docker-compose
}

/**
 * Result of a successful pipeline run.
 * Contains all step durations, artifact map, and the processed video URL.
 */
export interface PipelineResult {
  jobId: string;
  steps: { name: string; durationSeconds: number; status: string }[];
  artifacts: Record<string, string[]>; // stepName → [filenames]
  totalDurationSeconds: number;
  videoUrl: string;
}

/**
 * Custom error thrown when a pipeline step fails.
 * Contains the step name, container exit code, and error message from manifest.
 */
export class PipelineStepError extends Error {
  public readonly stepName: string;
  public readonly exitCode: number;
  public readonly errorMessage: string;

  constructor(stepName: string, exitCode: number, errorMessage: string) {
    super(`Pipeline step "${stepName}" failed (exit code ${exitCode}): ${errorMessage}`);
    this.name = "PipelineStepError";
    this.stepName = stepName;
    this.exitCode = exitCode;
    this.errorMessage = errorMessage;
  }
}

/**
 * Configuration for each pipeline step.
 * Matches docker-compose.yml exactly: order, image names, and env vars.
 *
 * Step order: whisper → silence-cutter → ffmpeg-finalizer → remotion-renderer → quality-finalizer → srt-exporter
 * Per process.sh and D-02/D-10.
 */
export const STEPS: PipelineStepConfig[] = [
  {
    name: "whisper",
    image: "reel-factory-whisper",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/input/video.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
      PIPELINE_JOB_ID: "{jobId}",
      HF_HOME: "/data/pipeline/.cache/huggingface",
    },
  },
  {
    name: "silence-cutter",
    image: "reel-factory-silence-cutter",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/input/video.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/silence-cutter/output.mp4",
      PIPELINE_JOB_ID: "{jobId}",
      TRANSCRIPT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
      SILENCE_MIN_DURATION: "0.5",
      SILENCE_CUT_SHRINK: "0.4",
    },
  },
  {
    name: "ffmpeg-finalizer",
    image: "reel-factory-ffmpeg-finalizer",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/silence-cutter/output.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/ffmpeg-finalizer/output.mp4",
      PIPELINE_JOB_ID: "{jobId}",
      VERTICAL_WIDTH: "1080",
      VERTICAL_HEIGHT: "1920",
      CROP_STRATEGY: "center",
    },
  },
  {
    name: "remotion-renderer",
    image: "reel-factory-remotion-renderer",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/ffmpeg-finalizer/output.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/remotion-renderer/output.mp4",
      PIPELINE_JOB_ID: "{jobId}",
      TRANSCRIPT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
      SILENCE_CUTS_PATH: "/data/pipeline/{jobId}/silence-cutter/silence-cuts.json",
      FINALIZER_INFO_PATH: "/data/pipeline/{jobId}/ffmpeg-finalizer/finalizer-info.json",
      ACTIVE_COLOR: "#FFFF00",
      INACTIVE_COLOR: "#FFFFFF",
      FONT_SIZE: "58",
      // Phase 14 (D-06, D-07): Enable scale:2 supersampling + lossless PNG frame capture in the pipeline.
      REMOTION_SCALE: "2",
      REMOTION_IMAGE_FORMAT: "png",
    },
  },
  // Phase 14 (RENDER-03): Lanczos-downscale 2160x3840 supersampled output to deliverable 1080x1920.
  {
    name: "quality-finalizer",
    image: "reel-factory-quality-finalizer",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/remotion-renderer/output.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/quality-finalizer/output.mp4",
      PIPELINE_JOB_ID: "{jobId}",
    },
  },
  {
    name: "srt-exporter",
    image: "reel-factory-srt-exporter",
    envVars: {
      INPUT_PATH: "/data/pipeline/{jobId}/input/video.mp4",
      OUTPUT_PATH: "/data/pipeline/{jobId}/srt-exporter/output.vtt",
      PIPELINE_JOB_ID: "{jobId}",
      TRANSCRIPT_PATH: "/data/pipeline/{jobId}/whisper/transcript.json",
      SILENCE_CUTS_PATH: "/data/pipeline/{jobId}/silence-cutter/silence-cuts.json",
    },
  },
];

/**
 * Demultiplex Docker's non-TTY log stream framing into plain text.
 * Each frame is an 8-byte header [streamType(1), 0,0,0, size(4, big-endian)]
 * followed by the payload. Falls back to a raw UTF-8 decode if the buffer is
 * not framed (e.g. a TTY container or an already-decoded string).
 */
function demuxDockerLogs(buf: Buffer): string {
  if (!buf || buf.length === 0) return "";
  let out = "";
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const streamType = buf[offset];
    const size = buf.readUInt32BE(offset + 4);
    if (streamType > 2 || offset + 8 + size > buf.length) {
      return buf.toString("utf8"); // not framed — decode as-is
    }
    out += buf.subarray(offset + 8, offset + 8 + size).toString("utf8");
    offset += 8 + size;
  }
  return out || buf.toString("utf8");
}

/**
 * Resolves env vars for a step, replacing {jobId} placeholders with actual jobId.
 * This allows the STEPS config to contain path templates that are resolved at runtime.
 */
function resolveEnvVars(step: PipelineStepConfig, jobId: string): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(step.envVars)) {
    resolved[key] = value.replace(/\{jobId\}/g, jobId);
  }
  return resolved;
}

/**
 * Options for running the pipeline.
 * Allows dependency injection for testing.
 */
export interface RunPipelineOptions {
  /** Override the pipeline data directory (for testing) */
  pipelineDataDir?: string;
  /** Override the host-side pipeline directory for Docker bind mounts */
  hostPipelineDir?: string;
  /** Override the Docker network name (for testing or different Compose project) */
  pipelineNetwork?: string;
  /** Override the Docker instance (for testing) */
  docker?: Dockerode;
  /** Callback invoked before each pipeline step starts */
  onStepStart?: (stepName: string, stepIndex: number, totalSteps: number) => Promise<void>;
}

/**
 * Runs the full pipeline: all 5 Docker containers sequentially.
 *
 * For each step:
 * 1. Creates a Docker container with the correct image and env vars
 * 2. Starts the container and waits for completion
 * 3. Reads the step's manifest.json to check success/failure
 * 4. If manifest.status is "error" or container exits non-zero without manifest, throws PipelineStepError
 * 5. Collects step results and artifact file lists
 *
 * Returns PipelineResult with all step durations, artifact map, and video URL.
 */
export async function runPipeline(
  jobId: string,
  options: RunPipelineOptions = {}
): Promise<PipelineResult> {
  const pipelineDir = options.pipelineDataDir || PIPELINE_DATA_DIR;
  const hostPipelineDir = options.hostPipelineDir || HOST_PIPELINE_DIR;
  const docker = options.docker || new Dockerode();

  const steps: PipelineResult["steps"] = [];
  const artifacts: Record<string, string[]> = {};
  const pipelineStartTime = Date.now();

  for (let stepIndex = 0; stepIndex < STEPS.length; stepIndex++) {
    const step = STEPS[stepIndex];
    const envVars = resolveEnvVars(step, jobId);

    // Notify progress before starting each step
    if (options.onStepStart) {
      await options.onStepStart(step.name, stepIndex, STEPS.length);
    }

    // Convert envVars to Docker format (array of KEY=VALUE strings)
    const envArray = Object.entries(envVars).map(
      ([key, value]) => `${key}=${value}`
    );

    const containerConfig: Dockerode.CreateContainerOptions = {
      Image: step.image,
      Env: envArray,
      HostConfig: {
        Binds: [`${hostPipelineDir}:/data/pipeline`],
        NetworkMode: options.pipelineNetwork || PIPELINE_NETWORK,
        // AutoRemove off: we must wait(), read logs, and inspect the exit code
        // BEFORE the container disappears. We remove it explicitly afterwards.
        AutoRemove: false,
      },
    };

    // Pass GPU device for whisper step if available
    if (step.name === "whisper") {
      containerConfig.HostConfig!.DeviceRequests = [
        {
          Driver: "nvidia",
          Count: -1,
          DeviceIDs: undefined,
          Capabilities: [["gpu"]],
        },
      ];
    }

    const container = await docker.createContainer(containerConfig);

    // Start the container, wait for it to finish, capture its logs while it
    // still exists, then always remove it (AutoRemove is off to avoid the
    // race where the container vanishes before wait()/logs() resolve).
    let exitCode = 1;
    try {
      await container.start();

      const exitResult = await container.wait();
      exitCode = typeof exitResult === "object" && "StatusCode" in exitResult
        ? (exitResult as { StatusCode: number }).StatusCode
        : 1;

      const rawLogs = await container.logs({ follow: false, stdout: true, stderr: true });
      const logOutput = demuxDockerLogs(rawLogs as unknown as Buffer).trim();
      if (logOutput) {
        console.log(`[${step.name}] ${logOutput}`);
      }
    } finally {
      await container.remove({ force: true }).catch(() => { /* already gone */ });
    }

    // Read manifest.json from the step's output directory
    const manifestFilePath = path.join(
      pipelineDir,
      jobId,
      step.name,
      "manifest.json"
    );

    let manifest: PipelineManifest | null = null;
    try {
      const manifestContent = await fs.readFile(manifestFilePath, "utf-8");
      manifest = JSON.parse(manifestContent) as PipelineManifest;
    } catch {
      // Manifest not found or not readable — container may have crashed before writing it
    }

    // Check for failure conditions
    if (manifest && manifest.status === "error") {
      throw new PipelineStepError(
        step.name,
        manifest.exit_code,
        manifest.error_message || "Unknown error"
      );
    }

    if (exitCode !== 0) {
      throw new PipelineStepError(
        step.name,
        exitCode,
        manifest?.error_message || `Container exited with code ${exitCode}`
      );
    }

    // Guard against silent failure: a step can exit 0 yet not produce its
    // declared output, which would otherwise only surface as a confusing
    // missing-input error in the NEXT step. Verify the output file exists.
    const declaredOutput = envVars.OUTPUT_PATH;
    if (declaredOutput) {
      const outputOnHost = declaredOutput.replace("/data/pipeline", pipelineDir);
      try {
        await fs.access(outputOnHost);
      } catch {
        throw new PipelineStepError(
          step.name,
          exitCode,
          `Step exited 0 but its declared output is missing: ${declaredOutput}`
        );
      }
    }

    // Collect step results
    const durationSeconds = manifest?.duration_seconds ?? 0;

    steps.push({
      name: step.name,
      durationSeconds,
      status: "success",
    });

    // Collect artifact file list from the step directory
    const stepDir = path.join(pipelineDir, jobId, step.name);
    try {
      const stepFiles = await fs.readdir(stepDir);
      artifacts[step.name] = stepFiles;
    } catch {
      artifacts[step.name] = [];
    }
  }

  const totalDurationSeconds = (Date.now() - pipelineStartTime) / 1000;

  return {
    jobId,
    steps,
    artifacts,
    totalDurationSeconds,
    videoUrl: `/artifacts/${jobId}/quality-finalizer/output.mp4`,
  };
}