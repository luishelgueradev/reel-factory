/**
 * SRT/VTT Subtitle Export Service — Main Entrypoint
 *
 * Reads Whisper transcript data and silence-cuts data, remaps timestamps
 * to the post-silence-removal timeline, and generates SRT + VTT sidecar files.
 *
 * Per D-01: Follows the pipeline step contract (INPUT_PATH/OUTPUT_PATH).
 * Per D-02: Uses Node.js runtime for direct TypeScript reuse of remap logic.
 * Per D-11: Outputs output.srt, output.vtt, and manifest.json.
 */

import fs from "fs";
import path from "path";
import { areTimestampsAlreadyRemapped } from "./timestamp-remap";
import { buildCuesFromTranscript, generateSrt, generateVtt } from "./formats";
import type { WhisperTranscript, SilenceCutList } from "./types";

function writeManifest(
  outputDir: string,
  inputPath: string,
  outputFiles: string[],
  durationSec: number,
  status: "success" | "error",
  exitCode: number,
  errorMsg?: string
) {
  const manifest = {
    step_name: "srt-exporter",
    input_file: inputPath,
    output_files: outputFiles,
    duration_seconds: Math.round(durationSec * 100) / 100,
    timestamp: new Date().toISOString(),
    status,
    exit_code: exitCode,
    ...(errorMsg ? { error_message: errorMsg } : {}),
  };
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function main() {
  const startTime = Date.now();

  const transcriptPath = process.env.TRANSCRIPT_PATH;
  const silenceCutsPath = process.env.SILENCE_CUTS_PATH;
  const outputPath = process.env.OUTPUT_PATH;
  const jobId = process.env.PIPELINE_JOB_ID;

  // Validate required env vars per T-01: TRANSCRIPT_PATH is required
  if (!transcriptPath) {
    console.error("ERROR: TRANSCRIPT_PATH environment variable must be set");
    process.exit(1);
  }

  if (!fs.existsSync(transcriptPath)) {
    console.error(`ERROR: Transcript file not found: ${transcriptPath}`);
    process.exit(1);
  }

  // Derive output directory from OUTPUT_PATH env var, or use default
  const outputDir = outputPath
    ? path.dirname(outputPath)
    : jobId
      ? `/data/pipeline/${jobId}/srt-exporter`
      : "./output";
  fs.mkdirSync(outputDir, { recursive: true });

  // Load transcript.json per D-01 and render.ts pattern
  let transcript: WhisperTranscript;
  try {
    transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
    console.log(`[srt-exporter] Loaded transcript: ${transcript.words?.length ?? 0} words, ${transcript.segments?.length ?? 0} segments`);
  } catch (e) {
    const msg = `Failed to parse transcript: ${(e as Error).message}`;
    console.error("ERROR:", msg);
    writeManifest(outputDir, transcriptPath, [], (Date.now() - startTime) / 1000, "error", 1, msg);
    process.exit(1);
  }

  // Load silence-cuts.json per D-01 (null-safe, same pattern as render.ts)
  let silenceCuts: SilenceCutList | null = null;
  if (silenceCutsPath && fs.existsSync(silenceCutsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(silenceCutsPath, "utf-8"));
      if (parsed && Array.isArray(parsed.cuts)) {
        silenceCuts = parsed as SilenceCutList;
        console.log(`[srt-exporter] Loaded ${silenceCuts.cuts.length} silence cuts`);
      } else {
        console.warn("WARN: silence-cuts.json missing or has invalid 'cuts' array, using original timestamps");
      }
    } catch (e) {
      console.warn("WARN: Failed to parse silence-cuts.json, using original timestamps:", (e as Error).message);
    }
  } else if (silenceCutsPath) {
    console.warn("WARN: SILENCE_CUTS_PATH set but file not found:", silenceCutsPath);
  }

  // Determine effective silence cuts (skip remap if timestamps already on the
  // silence-removed timeline). NOTE: areTimestampsAlreadyRemapped is a heuristic
  // (max word end vs new_duration + tolerance) and can misfire on short videos —
  // see timestamp-remap.ts. In this pipeline whisper runs on the ORIGINAL video,
  // so remap is generally required; the auto-detect guards the (rare) cut-video case.
  const alreadyRemapped = silenceCuts && transcript.words && transcript.words.length > 0
    ? areTimestampsAlreadyRemapped(transcript.words, silenceCuts)
    : false;
  if (silenceCuts) {
    console.log(
      alreadyRemapped
        ? "[srt-exporter] Detected timestamps already on silence-removed timeline — skipping remap"
        : "[srt-exporter] Timestamps on original timeline — applying remap"
    );
  }
  const effectiveSilenceCuts = alreadyRemapped ? null : silenceCuts;

  // Build cues from transcript using segment boundaries per D-04. Cue timing is
  // remapped at the segment level inside buildCuesFromTranscript.
  // KNOWN LIMITATION (D-06): cue *text* comes from segment.text verbatim, so
  // words Whisper may have hallucinated inside a silence cut are not stripped
  // from the text — only segment timing is remapped. Word-level cue rebuilding
  // would fix this but is a larger change; deferred.
  const cues = buildCuesFromTranscript(transcript, effectiveSilenceCuts);

  // Generate SRT and VTT output per D-07, D-08
  const srtContent = generateSrt(cues);
  const vttContent = generateVtt(cues);

  // Write output files per D-11
  const srtPath = path.join(outputDir, "output.srt");
  const vttPath = path.join(outputDir, "output.vtt");

  fs.writeFileSync(srtPath, srtContent, "utf-8");
  console.log(`[srt-exporter] Wrote ${srtPath} (${cues.length} cues)`);

  fs.writeFileSync(vttPath, vttContent, "utf-8");
  console.log(`[srt-exporter] Wrote ${vttPath} (${cues.length} cues)`);

  // Write manifest per D-11 and render.ts pattern
  const elapsedSec = (Date.now() - startTime) / 1000;
  writeManifest(
    outputDir,
    transcriptPath,
    [srtPath, vttPath],
    elapsedSec,
    "success",
    0,
  );

  console.log(`[srt-exporter] Completed in ${elapsedSec.toFixed(2)}s — ${cues.length} cues generated`);
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});