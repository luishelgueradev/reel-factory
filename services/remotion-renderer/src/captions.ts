import { createTikTokStyleCaptions, type TikTokPage, type Caption } from "@remotion/captions";

interface WhisperWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  no_speech_prob: number;
}

interface WhisperTranscript {
  language: string;
  model: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words: WhisperWord[];
  }>;
  words: WhisperWord[];
  duration: number;
}

export function transcriptToCaptionPages(
  transcript: WhisperTranscript,
  options: {
    combineTokensWithinMilliseconds?: number;
  } = {}
): TikTokPage[] {
  const { combineTokensWithinMilliseconds = 1500 } = options;

  const captions: Caption[] = transcript.words.map((w, i) => ({
    text: i === 0 ? w.word : ` ${w.word}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: w.confidence,
  }));

  if (captions.length === 0) {
    return [];
  }

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds,
  });

  return pages;
}