import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { transcriptToCaptionPages, areTimestampsAlreadyRemapped } from "./captions.js";
import type { SilenceCutList, FinalizerInfo } from "./captions.js";
import type { TikTokPage } from "@remotion/captions";
import type { RemotionProps } from "./Root.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function getVideoDimensions(videoPath: string): { width: number; height: number; durationSec: number } {
  const probeOut = execSync(
    `ffprobe -v error -show_entries stream=width,height -show_entries format=duration -of json "${videoPath}"`,
    { encoding: "utf-8" }
  );
  const data = JSON.parse(probeOut);
  const videoStream = data.streams.find((s: any) => s.codec_name !== undefined && s.width !== undefined);
  const width = videoStream?.width ?? 1080;
  const height = videoStream?.height ?? 1920;
  const duration = parseFloat(data.format?.duration ?? "10");
  return { width, height, durationSec: duration };
}

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
    step_name: "remotion-renderer",
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

function writeCaptionPages(outputDir: string, pages: TikTokPage[]) {
  const serializable = pages.map((p) => ({
    startMs: p.startMs,
    durationMs: p.durationMs,
    text: p.text,
    tokens: p.tokens.map((t) => ({
      text: t.text,
      fromMs: t.fromMs,
      toMs: t.toMs,
    })),
  }));
  fs.writeFileSync(
    path.join(outputDir, "caption-pages.json"),
    JSON.stringify(serializable, null, 2)
  );
}

async function main() {
  const startTime = Date.now();

  const inputPath = process.env.INPUT_PATH;
  const outputPath = process.env.OUTPUT_PATH;
  const transcriptPath = process.env.TRANSCRIPT_PATH;
  const silenceCutsPath = process.env.SILENCE_CUTS_PATH;
  const finalizerInfoPath = process.env.FINALIZER_INFO_PATH;
  const jobId = process.env.PIPELINE_JOB_ID;

  if (!inputPath || !outputPath || !jobId) {
    console.error("ERROR: INPUT_PATH, OUTPUT_PATH, and PIPELINE_JOB_ID must be set");
    process.exit(1);
  }
  if (!transcriptPath) {
    console.error("ERROR: TRANSCRIPT_PATH must be set");
    process.exit(1);
  }

  console.log("[remotion-renderer] Starting subtitle render for job:", jobId);
  console.log("  INPUT_PATH:", inputPath);
  console.log("  TRANSCRIPT:", transcriptPath);
  console.log("  OUTPUT:", outputPath);
  console.log("  SILENCE_CUTS:", silenceCutsPath || "(not provided, using original timestamps)");
  console.log("  FINALIZER_INFO:", finalizerInfoPath || "(not provided, using defaults)");

  if (!fs.existsSync(inputPath)) {
    const msg = `Input video not found: ${inputPath}`;
    console.error("ERROR:", msg);
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    writeManifest(outputDir, inputPath, [], (Date.now() - startTime) / 1000, "error", 1, msg);
    process.exit(1);
  }

  if (!fs.existsSync(transcriptPath)) {
    const msg = `Transcript not found: ${transcriptPath}`;
    console.error("ERROR:", msg);
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    writeManifest(outputDir, inputPath, [], (Date.now() - startTime) / 1000, "error", 1, msg);
    process.exit(1);
  }

  // Load silence-cuts.json if provided (D-01, D-03, T-05-04: try/catch for malformed JSON)
  let silenceCuts: SilenceCutList | null = null;
  if (silenceCutsPath && fs.existsSync(silenceCutsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(silenceCutsPath, "utf-8"));
      if (parsed && Array.isArray(parsed.cuts)) {
        silenceCuts = parsed as SilenceCutList;
        console.log(`  Loaded ${silenceCuts.cuts.length} silence cuts`);
      } else {
        console.warn("WARN: silence-cuts.json missing or has invalid 'cuts' array, using original timestamps");
      }
    } catch (e) {
      console.warn("WARN: Failed to parse silence-cuts.json, using original timestamps:", (e as Error).message);
    }
  } else if (silenceCutsPath) {
    console.warn("WARN: SILENCE_CUTS_PATH set but file not found:", silenceCutsPath);
  }

  // Load finalizer-info.json if provided (D-08, T-05-04: try/catch for malformed JSON)
  let finalizerInfo: FinalizerInfo | null = null;
  if (finalizerInfoPath && fs.existsSync(finalizerInfoPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(finalizerInfoPath, "utf-8"));
      if (parsed && parsed.safe_zone) {
        finalizerInfo = parsed as FinalizerInfo;
        console.log("  Loaded finalizer-info.json, safe_zone:", finalizerInfo.safe_zone);
      } else {
        console.warn("WARN: finalizer-info.json missing safe_zone, using default bottom offset");
      }
    } catch (e) {
      console.warn("WARN: Failed to parse finalizer-info.json, using defaults:", (e as Error).message);
    }
  } else if (finalizerInfoPath) {
    console.warn("WARN: FINALIZER_INFO_PATH set but file not found:", finalizerInfoPath);
  }

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    console.log("[remotion-renderer] Step 1: Probing input video dimensions");
    const { width: videoWidth, height: videoHeight, durationSec } = getVideoDimensions(inputPath);
    console.log(`  ${videoWidth}x${videoHeight} ${durationSec.toFixed(1)}s`);

    console.log("[remotion-renderer] Step 2: Loading transcript and creating caption pages");
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
    const captionPages = transcriptToCaptionPages(transcript, { silenceCuts, combineTokensWithinMilliseconds: 1500 });
    console.log(`  ${transcript.words.length} words -> ${captionPages.length} caption pages`);

    if (silenceCuts) {
      const alreadyRemapped = areTimestampsAlreadyRemapped(transcript.words, silenceCuts);
      console.log(`  Timestamp timeline: ${alreadyRemapped ? 'already on silence-removed timeline (skipping remap)' : 'original timeline (applying remap)'}`);
    } else {
      console.log('  Timestamp timeline: no silence cuts data (using original timestamps)');
    }

    const totalDurationMs = Math.round(durationSec * 1000);

    writeCaptionPages(outputDir, captionPages);
    console.log("  Wrote caption-pages.json");

    console.log("[remotion-renderer] Step 3: Copying video to Remotion public/ directory");
    const publicDir = path.join(process.cwd(), "public");
    fs.mkdirSync(publicDir, { recursive: true });
    const videoFileName = "input-video.mp4";
    const publicVideoPath = path.join(publicDir, videoFileName);
    fs.copyFileSync(inputPath, publicVideoPath);
    console.log(`  Copied ${inputPath} -> public/${videoFileName}`);

    console.log("[remotion-renderer] Step 4: Bundling Remotion project");
    const entryPoint = path.resolve(path.join(process.cwd(), "src", "Root.tsx"));
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
      publicDir: path.join(process.cwd(), "public"),
    });
    console.log("  Bundle ready:", bundleLocation);

    console.log("[remotion-renderer] Step 5: Selecting composition");
    console.log(`  inputProps: totalDurationMs=${totalDurationMs}, videoSrc=${videoFileName}, captionPages=${captionPages.length} pages`);
    // T-05-06: Validate safe_zone.bottom is a positive integer, fall back to 250
    const safeZone = finalizerInfo?.safe_zone;
    const bottomOffset = (safeZone && typeof safeZone.bottom === 'number' && safeZone.bottom > 0)
      ? Math.round(safeZone.bottom)
      : 250;

    const inputProps: RemotionProps = {
      videoSrc: videoFileName,
      captionPages,
      videoWidth,
      videoHeight,
      totalDurationMs,
      activeColor: process.env.ACTIVE_COLOR || "#FFFF00",
      inactiveColor: process.env.INACTIVE_COLOR || "#FFFFFF",
      fontSize: parseInt(process.env.FONT_SIZE || "58", 10),
      bottomOffset,
    };
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "SubtitledVideo",
      inputProps,
    });
    console.log(`  Duration: ${composition.durationInFrames} frames (${(composition.durationInFrames / 30).toFixed(1)}s)`);

    console.log("[remotion-renderer] Step 6: Rendering video with subtitles");
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`  Render: ${Math.round(progress * 100)}%`);
        }
      },
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
        args: ['--gl=angle-egl', '--disable-gpu'],
      },
    });
    console.log("  Render complete:", outputPath);

    const renderInfo = {
      input_width: videoWidth,
      input_height: videoHeight,
      total_words: transcript.words.length,
      caption_pages: captionPages.length,
      silence_cuts_applied: silenceCuts ? silenceCuts.cuts.length : 0,
      timestamps_already_remapped: silenceCuts ? areTimestampsAlreadyRemapped(transcript.words, silenceCuts) : false,
      safe_zone_used: safeZone || null,
      bottom_offset: bottomOffset,
      codec: "h264",
      fps: 30,
      remotion_info: {
        use_angle_egl: true,
      },
    };
    fs.writeFileSync(
      path.join(outputDir, "remotion-info.json"),
      JSON.stringify(renderInfo, null, 2)
    );

    const elapsedSec = (Date.now() - startTime) / 1000;
    writeManifest(outputDir, inputPath, [outputPath, path.join(outputDir, "caption-pages.json"), path.join(outputDir, "remotion-info.json")], elapsedSec, "success", 0);
    console.log(`[remotion-renderer] Completed in ${elapsedSec.toFixed(2)}s`);
  } catch (err: any) {
    const msg = `Render failed: ${err.message || err}`;
    console.error("ERROR:", msg);
    if (err.stack) console.error(err.stack);
    const elapsedSec = (Date.now() - startTime) / 1000;
    writeManifest(outputDir, inputPath, [], elapsedSec, "error", 1, msg);
    process.exit(1);
  }
}

main();