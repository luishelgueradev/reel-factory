export const PIPELINE_DATA_DIR = "/data/pipeline";

export const INPUT_DIR_NAME = "input";

export const INPUT_VIDEO_FILENAME = "video.mp4";

export function inputPath(jobId: string): string {
  return `${PIPELINE_DATA_DIR}/${jobId}/${INPUT_DIR_NAME}/${INPUT_VIDEO_FILENAME}`;
}

export function stepOutputDir(jobId: string, stepName: string): string {
  return `${PIPELINE_DATA_DIR}/${jobId}/${stepName}`;
}

export const OUTPUT_FILENAMES = {
  transcript: "transcript.json",
  silenceCuts: "silence-cuts.json",
  outputVideo: "output.mp4",
  manifest: "manifest.json",
} as const;

export function manifestPath(jobId: string, stepName: string): string {
  return `${stepOutputDir(jobId, stepName)}/${OUTPUT_FILENAMES.manifest}`;
}

export const STEP_NAMES = {
  whisper: "whisper",
  silenceCutter: "silence-cutter",
  remotionRenderer: "remotion-renderer",
  ffmpegFinalizer: "ffmpeg-finalizer",
  srtExporter: "srt-exporter",
} as const;

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
} as const;

export function jobDirStructure(jobId: string): Record<string, string> {
  return {
    jobRoot: `${PIPELINE_DATA_DIR}/${jobId}`,
    inputDir: inputPath(jobId).replace(`/${INPUT_VIDEO_FILENAME}`, ""),
    inputFile: inputPath(jobId),
  };
}