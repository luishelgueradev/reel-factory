// TypeScript interfaces mirroring Python schemas for srt-exporter
// Adapted from services/remotion-renderer/src/captions.ts and services/silence-cutter/src/schema.py

/** Mirror of services/silence-cutter/src/schema.py SilenceCut */
export interface SilenceCut {
  original_start: number;
  original_end: number;
  new_start: number;
  new_end: number;
  duration: number;
  source: "both" | "ffmpeg" | "whisper";
  cumulative_shift: number;
}

/** Mirror of services/silence-cutter/src/schema.py SilenceCutList */
export interface SilenceCutList {
  total_segments_removed: number;
  total_silence_removed: number;
  original_duration: number;
  new_duration: number;
  cuts: SilenceCut[];
}

/** Mirror of services/whisper-http-step/src/schema.py TranscriptWord */
export interface WhisperWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  no_speech_prob: number;
}

/** Mirror of services/whisper-http-step/src/schema.py TranscriptSegment */
export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

/** Mirror of services/whisper-http-step/src/schema.py Transcript */
export interface WhisperTranscript {
  language: string;
  model: string;
  segments: WhisperSegment[];
  words: WhisperWord[];
  duration: number;
}

/** SRT subtitle cue */
export interface SrtCue {
  index: number;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

/** VTT subtitle cue (same shape as SrtCue per D-09) */
export type VttCue = SrtCue;