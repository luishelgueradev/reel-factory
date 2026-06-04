/**
 * metadata.ts — Pure, framework-free core for AI social metadata generation.
 *
 * Phase 25: AI Social Metadata (D-03, AI-SPEC §4, §4b, §6)
 *
 * Exports:
 *   - PLATFORMS / TONES specs
 *   - extractTranscriptText / detectLanguage
 *   - buildSystemPrompt
 *   - MetadataSchema / sanitizeMetadata
 *   - generateMetadata (injected ChatClient — network-free in tests)
 *   - Error classes: EmptyTranscriptError, MetadataValidationError
 *
 * Zero dependencies on Express / fetch / globals.
 * The ChatClient function is INJECTED so this module is unit-testable without network.
 */

import { z } from "zod";

// ─── Platform specs ────────────────────────────────────────────────────────────

export interface PlatformSpec {
  label: string;
  descMaxChars: number;
  hashtagStyle: string;
  notes: string;
}

export const PLATFORMS: Record<string, PlatformSpec> = {
  tiktok: {
    label: "TikTok",
    descMaxChars: 2200,
    hashtagStyle: "3–5 etiquetas cortas y específicas. Evitar listas largas de hashtags.",
    notes: "Título gancho en las primeras 5 palabras. Descripción breve y energética (≤150 chars idealmente). 3–5 hashtags relevantes y populares en TikTok.",
  },
  instagram: {
    label: "Instagram Reels",
    descMaxChars: 2200,
    hashtagStyle: "5–8 etiquetas mezcla de nicho + tendencia.",
    notes: "Descripción puede ser más larga (hasta ~2200 chars). 5–8 hashtags relevantes mezclando nichos con tendencias. Tono visual y aspiracional.",
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    descMaxChars: 5000,
    hashtagStyle: "3–5 etiquetas enfocadas en búsqueda (SEO).",
    notes: "Título descriptivo y searchable (el algoritmo de búsqueda importa). Descripción concisa con palabras clave. 3–5 hashtags orientados a SEO.",
  },
};

export type Platform = keyof typeof PLATFORMS;

// ─── Tone specs ────────────────────────────────────────────────────────────────

export interface ToneSpec {
  label: string;
  guidance: string;
}

export const TONES: Record<string, ToneSpec> = {
  cercano: {
    label: "Cercano",
    guidance: "Tono conversacional, cálido y directo. Habla de tú a tú, usa lenguaje coloquial pero claro. Genera empatía y cercanía con la audiencia.",
  },
  profesional: {
    label: "Profesional",
    guidance: "Tono formal, informativo y confiable. Usa vocabulario preciso y evita coloquialismos. Transmite autoridad y expertise sin ser frío.",
  },
  llamativo: {
    label: "Llamativo",
    guidance: "Tono impactante, urgente y con gancho fuerte. Usa palabras de poder, números cuando están en el transcript, y un CTA implícito. Genera curiosidad o FOMO.",
  },
};

export type Tone = keyof typeof TONES;

// ─── Output type ───────────────────────────────────────────────────────────────

export interface Metadata {
  title: string;
  description: string;
  hashtags: string[];
}

// ─── Error classes ─────────────────────────────────────────────────────────────

export class EmptyTranscriptError extends Error {
  constructor(message = "El transcript está vacío — no se puede generar metadata") {
    super(message);
    this.name = "EmptyTranscriptError";
  }
}

export class MetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataValidationError";
  }
}

// ─── Transcript utilities ──────────────────────────────────────────────────────

/**
 * Safely extracts and joins segment texts from a transcript object.
 *
 * - Reads transcript.segments[].text (gracefully handles malformed input).
 * - Collapses whitespace.
 * - If over maxChars: keeps head (~60%) + tail (~40%) separated by a marker.
 * - Never throws on malformed input — returns "" which the caller should handle.
 */
export function extractTranscriptText(
  transcript: unknown,
  maxChars = 8000
): string {
  if (!transcript || typeof transcript !== "object") return "";

  const t = transcript as Record<string, unknown>;
  const segments = t["segments"];

  if (!Array.isArray(segments) || segments.length === 0) {
    // Fallback: try top-level .text
    if (typeof t["text"] === "string") {
      const txt = t["text"].replace(/\s+/g, " ").trim();
      return truncateText(txt, maxChars);
    }
    return "";
  }

  const parts: string[] = [];
  for (const seg of segments) {
    if (!seg || typeof seg !== "object") continue;
    const text = (seg as Record<string, unknown>)["text"];
    if (typeof text === "string" && text.trim()) {
      parts.push(text.trim());
    }
  }

  if (parts.length === 0) return "";

  const joined = parts.join(" ").replace(/\s+/g, " ").trim();
  return truncateText(joined, maxChars);
}

/**
 * Truncates text to maxChars using head+tail strategy to preserve context.
 * Head gets ~60% of the budget, tail gets ~40%.
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = maxChars - headSize - 40; // 40 chars for the marker

  const head = text.slice(0, headSize).trim();
  const tail = text.slice(text.length - tailSize).trim();

  return `${head}\n\n[...transcript truncado...]\n\n${tail}`;
}

/**
 * Reads the language field from a transcript object.
 * Defaults to "es" if not present or not a string.
 */
export function detectLanguage(transcript: unknown): string {
  if (!transcript || typeof transcript !== "object") return "es";
  const t = transcript as Record<string, unknown>;
  if (typeof t["language"] === "string" && t["language"].trim()) {
    return t["language"].trim();
  }
  return "es";
}

// ─── Prompt construction ───────────────────────────────────────────────────────

/**
 * Builds the system prompt for the metadata generation call.
 *
 * Encodes:
 * - Role: editor de redes para reels verticales
 * - HARD rules (faithfulness, output language, JSON-only)
 * - Platform spec (length + hashtag style)
 * - Tone guidance
 */
export function buildSystemPrompt({
  platform,
  tone,
  language,
}: {
  platform: Platform;
  tone: Tone;
  language: string;
}): string {
  const platformSpec = PLATFORMS[platform];
  const toneSpec = TONES[tone];

  const platformLabel = platformSpec?.label ?? platform;
  const descMaxChars = platformSpec?.descMaxChars ?? 2200;
  const hashtagStyle = platformSpec?.hashtagStyle ?? "3–5 etiquetas relevantes.";
  const platformNotes = platformSpec?.notes ?? "";
  const toneLabel = toneSpec?.label ?? tone;
  const toneGuidance = toneSpec?.guidance ?? "";

  return `Eres un editor de redes sociales experto en crear contenido para reels verticales 9:16.

REGLAS DURAS (no negociables):
1. SOLO usa información que esté explícitamente en el transcript del usuario. NO inventes hechos, números, precios, nombres de productos ni afirmaciones que no estén en el contenido hablado. Si no está en el transcript, no lo incluyas.
2. El idioma de salida DEBE ser "${language}". Todo el contenido generado (título, descripción, hashtags) debe estar en "${language}".
3. Devuelve ÚNICAMENTE un objeto JSON válido con exactamente este formato: {"title": "...", "description": "...", "hashtags": ["#tag1", "#tag2"]}. Sin texto adicional, sin markdown, sin explicaciones — SOLO el JSON.

PLATAFORMA: ${platformLabel}
- Descripción: máximo ${descMaxChars} caracteres.
- Hashtags: ${hashtagStyle}
- Notas: ${platformNotes}

TONO: ${toneLabel}
${toneGuidance}

FORMATO DE HASHTAGS: Cada hashtag debe comenzar con # y contener solo letras, números o guiones bajos (sin espacios). Ejemplo: #ReelsEspañol, #Consejos2024.`;
}

// ─── Zod schema ────────────────────────────────────────────────────────────────

export const MetadataSchema = z.object({
  title: z.string().min(1).max(120),
  // Max is set to the highest platform limit (youtube_shorts = 5000).
  // Per-platform enforcement (e.g. tiktok/instagram at 2200) is handled in sanitizeMetadata
  // before this schema is evaluated, so zod only needs to catch truly unbounded values.
  description: z.string().min(1).max(5000),
  hashtags: z
    .array(z.string().regex(/^#[\p{L}0-9_]+$/u))
    .min(1)
    .max(12),
});

// ─── Sanitize ──────────────────────────────────────────────────────────────────

/**
 * Coerces and sanitizes raw model output into a valid Metadata object.
 *
 * Per AI-SPEC §4b and §6:
 * - Deduplicates hashtags (case-insensitive).
 * - Drops malformed hashtags (no leading #, contains spaces, or invalid chars).
 * - Ensures all hashtags start with #.
 * - Caps hashtags to ≤8 (after dedup + drop).
 * - Truncates description to platform.descMaxChars.
 * - Trims title.
 *
 * Throws MetadataValidationError if the result is still invalid after sanitization.
 */
export function sanitizeMetadata(
  raw: unknown,
  platform: Platform
): Metadata {
  if (!raw || typeof raw !== "object") {
    throw new MetadataValidationError(
      "La respuesta del modelo no es un objeto JSON válido"
    );
  }

  const r = raw as Record<string, unknown>;

  // Sanitize title
  const title = typeof r["title"] === "string" ? r["title"].trim() : "";

  // Sanitize description
  let description =
    typeof r["description"] === "string" ? r["description"].trim() : "";
  const platformSpec = PLATFORMS[platform];
  const maxDesc = platformSpec?.descMaxChars ?? 2200;
  if (description.length > maxDesc) {
    description = description.slice(0, maxDesc).trim();
  }

  // Sanitize hashtags
  const rawHashtags = Array.isArray(r["hashtags"]) ? r["hashtags"] : [];
  const hashtagPattern = /^#[\p{L}0-9_]+$/u;

  const seen = new Set<string>();
  const hashtags: string[] = [];

  for (const tag of rawHashtags) {
    if (typeof tag !== "string") continue;

    let t = tag.trim();

    // Ensure leading #
    if (t.length > 0 && !t.startsWith("#")) {
      t = `#${t}`;
    }

    // Drop if contains spaces or invalid chars
    if (!hashtagPattern.test(t)) continue;

    // Dedupe (case-insensitive)
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    hashtags.push(t);

    // Cap at 8
    if (hashtags.length >= 8) break;
  }

  // Validate with zod schema
  const result = MetadataSchema.safeParse({ title, description, hashtags });
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join("; ");
    throw new MetadataValidationError(
      `La metadata generada no supera la validación: ${issues}`
    );
  }

  return result.data;
}

// ─── ChatClient type ───────────────────────────────────────────────────────────

/**
 * Injected chat client — accepts system + user prompts, returns raw model content string.
 *
 * The real implementation (25-02) wraps a fetch to the local-llms router.
 * Tests inject a mock that returns controlled strings.
 */
export type ChatClient = (args: {
  system: string;
  user: string;
}) => Promise<string>;

// ─── Main generate function ────────────────────────────────────────────────────

/**
 * Generates social metadata from a transcript using the injected ChatClient.
 *
 * Flow:
 * 1. Extract transcript text (throw EmptyTranscriptError if empty).
 * 2. Detect language.
 * 3. Build system prompt (platform + tone).
 * 4. Call client with system + transcript text.
 * 5. JSON.parse the response → sanitize via zod.
 * 6. On JSON.parse / validation failure: ONE corrective retry.
 * 7. On second failure: throw MetadataValidationError.
 *
 * Never calls fetch — client is injected.
 */
export async function generateMetadata({
  transcript,
  platform,
  tone,
  client,
}: {
  transcript: unknown;
  platform: Platform;
  tone: Tone;
  client: ChatClient;
}): Promise<Metadata> {
  const text = extractTranscriptText(transcript);
  if (!text) {
    throw new EmptyTranscriptError();
  }

  const language = detectLanguage(transcript);
  const system = buildSystemPrompt({ platform, tone, language });

  // First attempt
  const raw1 = await client({ system, user: text });

  let parsed1: unknown;
  try {
    parsed1 = JSON.parse(raw1);
    return sanitizeMetadata(parsed1, platform);
  } catch {
    // Single corrective retry (AI-SPEC §4b)
    const correctionUser = `${text}\n\n---\nTu respuesta anterior no era JSON válido. Devolvé SOLO el JSON válido con el formato: {"title": "...", "description": "...", "hashtags": ["#tag1"]}. Sin texto adicional.`;

    const raw2 = await client({ system, user: correctionUser });

    let parsed2: unknown;
    try {
      parsed2 = JSON.parse(raw2);
    } catch {
      throw new MetadataValidationError(
        "No se pudo obtener JSON válido del modelo después de dos intentos"
      );
    }

    return sanitizeMetadata(parsed2, platform);
  }
}
