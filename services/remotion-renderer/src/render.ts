import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { transcriptToCaptionPages, shouldSkipSilenceRemap } from "./captions";
import type { SilenceCutList, FinalizerInfo } from "./captions";
import type { TikTokPage } from "@remotion/captions";
import type { RemotionProps } from "./Root";
import { validatePipelineConfig, DEFAULT_SUBTITLE_CONFIG, DEFAULT_VISUAL_EFFECTS } from "./pipeline-config";
import type { PipelineConfig, SubtitleLayoutMode, SubtitlePosition, SubtitleConfig, TitleConfig, VisualEffectsConfig } from "./pipeline-config";
import { detectZoomEvents } from "./zoom-detection";
import type { ZoomEvent } from "./zoom-detection";
import { buildTransitionEvents } from "./compositions/JumpCutTransition";
import type { TransitionEvent } from "./compositions/JumpCutTransition";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

function getVideoDimensions(videoPath: string): { width: number; height: number; durationSec: number } {
  const probeOut = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    videoPath,
  ], { encoding: "utf-8" });
  const data = JSON.parse(probeOut);
  // ffprobe was invoked with `-show_entries stream=width,height`, so codec_name
  // is never present — the video stream is simply the one carrying a width.
  const videoStream = data.streams.find((s: any) => s.width !== undefined && s.height !== undefined);
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

  // D-06 (Phase 14): Render quality params from env vars with safe backward-compatible defaults.
  // D-07 (Phase 14): Defaults are scale=1 + imageFormat='jpeg' so direct runs of render.ts outside
  // the orchestrator stay backward-compatible (no surprise 4K output). The orchestrator explicitly
  // sets REMOTION_SCALE=2 + REMOTION_IMAGE_FORMAT=png for the supersampled pipeline path.
  const remotionScale = parseFloat(process.env.REMOTION_SCALE || "1");
  const remotionCrf = parseInt(process.env.REMOTION_CRF || "18", 10);
  const remotionX264Preset = (process.env.REMOTION_X264_PRESET || "medium") as "medium" | "slow" | "fast";
  const remotionColorSpace = (process.env.REMOTION_COLOR_SPACE || "bt709") as "bt709";
  const remotionJpegQuality = parseInt(process.env.REMOTION_JPEG_QUALITY || "95", 10);
  const remotionImageFormat = (process.env.REMOTION_IMAGE_FORMAT || "jpeg") as "jpeg" | "png";
  // Cap Chrome page-pool size to prevent OOM on low-RAM hosts. Remotion defaults to ~cores/2
  // which on a 16-core machine with enableMultiProcessOnLinux exhausts ~7.5 GB RAM at frame 0.
  // Guard NaN (non-numeric env var) by || 2 fallback; floor at 1 so it's always a valid positive int.
  const remotionConcurrency = Math.max(1, parseInt(process.env.REMOTION_CONCURRENCY || "2", 10) || 2);

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

  // Load pipeline-config.json if provided (D-02, D-03: config takes precedence, env vars are fallback)
  const pipelineConfigPath = process.env.PIPELINE_CONFIG_PATH;
  let pipelineConfig: PipelineConfig | null = null;
  if (pipelineConfigPath && fs.existsSync(pipelineConfigPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pipelineConfigPath, "utf-8"));
      const validation = validatePipelineConfig(parsed);
      if (validation.valid) {
        pipelineConfig = parsed as PipelineConfig;
        console.log("  Loaded pipeline-config.json:", JSON.stringify(pipelineConfig.subtitle.layout));
        if (pipelineConfig.titles && pipelineConfig.titles.length > 0) {
          console.log(`  ${pipelineConfig.titles.length} title overlay(s) configured`);
        }
      } else {
        console.warn("WARN: pipeline-config.json validation failed:", validation.errors.join("; "));
        console.warn("  Falling back to environment variable defaults");
      }
    } catch (e) {
      console.warn("WARN: Failed to parse pipeline-config.json, using env var defaults:", (e as Error).message);
    }
  } else if (pipelineConfigPath) {
    console.warn("WARN: PIPELINE_CONFIG_PATH set but file not found:", pipelineConfigPath);
  }

  // D-11: Extract visual effects config with deep merge of defaults
  const visualEffects: VisualEffectsConfig = {
    ...DEFAULT_VISUAL_EFFECTS,
    ...pipelineConfig?.visualEffects,
    zooms: {
      ...DEFAULT_VISUAL_EFFECTS.zooms,
      ...pipelineConfig?.visualEffects?.zooms,
    },
    transitions: {
      ...DEFAULT_VISUAL_EFFECTS.transitions,
      ...pipelineConfig?.visualEffects?.transitions,
    },
  };

  if (pipelineConfig?.visualEffects) {
    console.log(`  Visual effects: zooms=${pipelineConfig.visualEffects.zooms?.enabled ?? false}, transitions=${pipelineConfig.visualEffects.transitions?.type ?? 'zoom'}`);
  } else {
    console.log(`  Visual effects: using defaults (zooms disabled, transitions: zoom)`);
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
      const alreadyRemapped = shouldSkipSilenceRemap(transcript, silenceCuts);
      const src = transcript.timeline ? `timeline marker='${transcript.timeline}'` : 'heuristic';
      console.log(`  Timestamp timeline: ${alreadyRemapped ? 'already on silence-removed timeline (skipping remap)' : 'original timeline (applying remap)'} [${src}]`);
    } else {
      console.log('  Timestamp timeline: no silence cuts data (using original timestamps)');
    }

    // D-01: Compute zoom events from transcript confidence + silence boundaries
    const zoomEvents: ZoomEvent[] = detectZoomEvents(
      transcript,
      silenceCuts,
      visualEffects.zooms
    );
    console.log(`  ${zoomEvents.length} zoom event(s) detected (threshold: ${visualEffects.zooms?.confidenceThreshold ?? 0.6})`);

    // D-05: Build transition events at silence cut boundaries
    const transitionEvents: TransitionEvent[] = buildTransitionEvents(
      silenceCuts,
      visualEffects.transitions
    );
    console.log(`  ${transitionEvents.length} transition event(s) at silence cut boundaries`);

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

    // D-03: Env var fallback — config takes precedence when present
    // WR-02: Guard against NaN from non-numeric FONT_SIZE env var
    const envFontSize = parseInt(process.env.FONT_SIZE || "58", 10);

    const inputProps: RemotionProps = {
      videoSrc: videoFileName,
      captionPages,
      videoWidth,
      videoHeight,
      totalDurationMs,
      subtitleLayout: pipelineConfig?.subtitle?.layout || ("tiktok" as SubtitleLayoutMode),
      subtitleConfig: {
        layout: pipelineConfig?.subtitle?.layout || "tiktok",
        fontFamily: pipelineConfig?.subtitle?.fontFamily,
        fontSize: pipelineConfig?.subtitle?.fontSize || (Number.isNaN(envFontSize) ? 58 : envFontSize),
        activeColor: pipelineConfig?.subtitle?.activeColor || process.env.ACTIVE_COLOR || "#FFFF00",
        inactiveColor: pipelineConfig?.subtitle?.inactiveColor || process.env.INACTIVE_COLOR || "#FFFFFF",
        outlineColor: pipelineConfig?.subtitle?.outlineColor,
        outlineWidth: pipelineConfig?.subtitle?.outlineWidth,
        backgroundHighlight: pipelineConfig?.subtitle?.backgroundHighlight,
        textShadow: pipelineConfig?.subtitle?.textShadow,
        letterSpacing: pipelineConfig?.subtitle?.letterSpacing,
        position: pipelineConfig?.subtitle?.position || "bottom-center",
        lineHeight: pipelineConfig?.subtitle?.lineHeight,
        bottomOffset: pipelineConfig?.subtitle?.bottomOffset || bottomOffset,
        pastWordOpacity: pipelineConfig?.subtitle?.pastWordOpacity,
        highlightColor: pipelineConfig?.subtitle?.highlightColor,
        highlightDurationMs: pipelineConfig?.subtitle?.highlightDurationMs,
        highlightTransition: pipelineConfig?.subtitle?.highlightTransition,
        subtitleWidth: pipelineConfig?.subtitle?.subtitleWidth,
      } satisfies SubtitleConfig,
      titles: pipelineConfig?.titles || [],
      // Phase 7: Visual effects (D-08, D-10)
      zoomEvents,
      transitionEvents,
    };
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "SubtitledVideo",
      inputProps,
    });
    console.log(`  Duration: ${composition.durationInFrames} frames (${(composition.durationInFrames / 30).toFixed(1)}s)`);

    console.log("[remotion-renderer] Step 6: Rendering video with subtitles");
    console.log("  Concurrency:", remotionConcurrency);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      concurrency: remotionConcurrency,        // Bounded page-pool — prevents Chrome OOM on low-RAM hosts
      scale: remotionScale,                    // RENDER-01 / D-06 (Phase 14)
      crf: remotionCrf,                        // RENDER-01 / D-06 (Phase 14)
      x264Preset: remotionX264Preset,          // RENDER-01 / D-06 (Phase 14)
      colorSpace: remotionColorSpace,          // D-11 (Phase 14): sRGB→BT.709 conversion at Chromium boundary
      jpegQuality: remotionJpegQuality,        // RENDER-02 / D-05 (Phase 14): inert when imageFormat='png'
      imageFormat: remotionImageFormat,        // RENDER-02 / D-04 (Phase 14): lossless PNG via env
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`  Render: ${Math.round(progress * 100)}%`);
        }
      },
      // D-03 (Phase 14): 3h ceiling; was 120000 — scale:2 render of a 60s clip takes ~47min
      timeoutInMilliseconds: 10_800_000,
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
      timestamps_already_remapped: silenceCuts ? shouldSkipSilenceRemap(transcript, silenceCuts) : false,
      safe_zone_used: safeZone || null,
      bottom_offset: bottomOffset,
      codec: "h264",
      fps: 30,
      remotion_info: {
        use_angle_egl: true,
        // Phase 14 (D-06): diagnostic mirror of the env-driven render params
        scale: remotionScale,
        image_format: remotionImageFormat,
        crf: remotionCrf,
        x264_preset: remotionX264Preset,
        color_space: remotionColorSpace,
        jpeg_quality: remotionJpegQuality,
      },
      // D-02: PipelineConfig info for debugging
      pipeline_config: pipelineConfig ? {
        loaded: true,
        source: pipelineConfigPath || "unknown",
        subtitle_layout: pipelineConfig.subtitle.layout,
        subtitle_position: pipelineConfig.subtitle.position || DEFAULT_SUBTITLE_CONFIG.position,
        titles_count: pipelineConfig.titles?.length || 0,
      } : {
        loaded: false,
        source: "env_vars",
        subtitle_layout: "tiktok",
        subtitle_position: "bottom-center",
        titles_count: 0,
      },
      // Phase 7: Visual effects info for debugging
      visual_effects: {
        zoom_count: zoomEvents.length,
        transition_count: transitionEvents.length,
        zoom_enabled: visualEffects.zooms?.enabled ?? false,
        transition_type: visualEffects.transitions?.type ?? "zoom",
        confidence_threshold: visualEffects.zooms?.confidenceThreshold ?? 0.6,
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