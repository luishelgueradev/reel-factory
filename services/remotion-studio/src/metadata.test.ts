// @vitest-environment node
/**
 * metadata.test.ts — Unit proofs for the metadata.ts pure core module.
 *
 * Phase 25: AI Social Metadata (META-01, META-02, META-04)
 *
 * All tests use a mock ChatClient — zero network calls.
 * Covers: extractTranscriptText, detectLanguage, buildSystemPrompt,
 * MetadataSchema/sanitizeMetadata, generateMetadata (happy/retry/error/empty).
 */

import { describe, it, expect, vi } from "vitest";
import {
  extractTranscriptText,
  detectLanguage,
  buildSystemPrompt,
  MetadataSchema,
  sanitizeMetadata,
  generateMetadata,
  EmptyTranscriptError,
  MetadataValidationError,
  PLATFORMS,
  TONES,
} from "./metadata.js";
import type { ChatClient, Platform, Tone } from "./metadata.js";

// ─── Fixture: realistic Spanish transcript ────────────────────────────────────

const SPANISH_TRANSCRIPT = {
  language: "es",
  model: "whisperx-large-v3",
  duration: 62.4,
  segments: [
    {
      id: 0,
      start: 0.321,
      end: 5.12,
      text: "Dentro de muy poco los sitios web van a tener que actualizarse, sobre todo los sitios web de e-commerce",
    },
    {
      id: 1,
      start: 5.5,
      end: 11.0,
      text: "porque Google está cambiando su algoritmo y va a priorizar los sitios que tengan experiencia de usuario optimizada",
    },
    {
      id: 2,
      start: 11.3,
      end: 17.8,
      text: "Si tu sitio web no está actualizado en los próximos tres meses vas a perder posicionamiento",
    },
    {
      id: 3,
      start: 18.1,
      end: 24.5,
      text: "y eso significa menos tráfico, menos ventas, menos clientes para tu negocio",
    },
    {
      id: 4,
      start: 25.0,
      end: 32.0,
      text: "Las tres cosas más importantes que tenés que hacer son: primero, mejorar la velocidad de carga de tu sitio",
    },
    {
      id: 5,
      start: 32.5,
      end: 40.0,
      text: "segundo, asegurarte que sea 100% responsive en móvil porque el 80% del tráfico viene de celulares",
    },
    {
      id: 6,
      start: 40.5,
      end: 48.0,
      text: "y tercero, optimizar las imágenes y el código para que cargue en menos de tres segundos",
    },
    {
      id: 7,
      start: 48.5,
      end: 58.0,
      text: "Si hacés estas tres cosas, tu sitio va a estar preparado para el nuevo algoritmo de Google y vas a mantener tu ranking",
    },
  ],
};

const ENGLISH_TRANSCRIPT = {
  language: "en",
  segments: [
    { text: "Today we talk about productivity hacks for remote workers." },
    { text: "The first tip is to set clear boundaries between work and personal time." },
  ],
};

// ─── extractTranscriptText ────────────────────────────────────────────────────

describe("extractTranscriptText", () => {
  it("joins all segment texts with a space", () => {
    const result = extractTranscriptText(SPANISH_TRANSCRIPT);
    expect(result).toContain("Dentro de muy poco");
    expect(result).toContain("Google está cambiando su algoritmo");
    expect(result).toContain("mantener tu ranking");
  });

  it("collapses multiple whitespace into a single space", () => {
    const t = {
      segments: [{ text: "  hola   mundo  " }, { text: "  foo   " }],
    };
    const result = extractTranscriptText(t);
    expect(result).toBe("hola mundo foo");
  });

  it("returns empty string for null transcript", () => {
    expect(extractTranscriptText(null)).toBe("");
  });

  it("returns empty string for undefined transcript", () => {
    expect(extractTranscriptText(undefined)).toBe("");
  });

  it("returns empty string for non-object transcript", () => {
    expect(extractTranscriptText("bad input")).toBe("");
    expect(extractTranscriptText(42)).toBe("");
  });

  it("returns empty string for transcript with no segments", () => {
    expect(extractTranscriptText({ language: "es" })).toBe("");
    expect(extractTranscriptText({ segments: [] })).toBe("");
  });

  it("returns empty string for transcript with empty segment texts", () => {
    const t = { segments: [{ text: "" }, { text: "   " }] };
    expect(extractTranscriptText(t)).toBe("");
  });

  it("falls back to top-level .text when no segments", () => {
    const t = { text: "  hello world  " };
    expect(extractTranscriptText(t)).toBe("hello world");
  });

  it("truncates text over the budget using head+tail strategy", () => {
    // Create a transcript with 200 chars per segment x 10 = 2000 chars
    const longText = "a".repeat(200);
    const t = {
      segments: Array.from({ length: 10 }, () => ({ text: longText })),
    };
    const result = extractTranscriptText(t, 500);
    expect(result.length).toBeLessThanOrEqual(560); // head+tail+marker
    expect(result).toContain("[...transcript truncado...]");
  });

  it("does NOT truncate when within budget", () => {
    const result = extractTranscriptText(SPANISH_TRANSCRIPT);
    expect(result).not.toContain("[...transcript truncado...]");
  });

  it("skips non-object or null segments without throwing", () => {
    const t = { segments: [null, undefined, 42, { text: "valid" }, { text: null }] };
    expect(extractTranscriptText(t)).toBe("valid");
  });
});

// ─── detectLanguage ───────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  it("returns the transcript language field", () => {
    expect(detectLanguage(SPANISH_TRANSCRIPT)).toBe("es");
    expect(detectLanguage(ENGLISH_TRANSCRIPT)).toBe("en");
  });

  it('defaults to "es" when language is absent', () => {
    expect(detectLanguage({ segments: [] })).toBe("es");
  });

  it('defaults to "es" for null/undefined/non-object input', () => {
    expect(detectLanguage(null)).toBe("es");
    expect(detectLanguage(undefined)).toBe("es");
    expect(detectLanguage("bad")).toBe("es");
  });

  it('defaults to "es" when language is empty string', () => {
    expect(detectLanguage({ language: "" })).toBe("es");
    expect(detectLanguage({ language: "   " })).toBe("es");
  });

  it("trims whitespace from language value", () => {
    expect(detectLanguage({ language: "  pt  " })).toBe("pt");
  });
});

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("includes the platform label in the prompt", () => {
    const prompt = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    expect(prompt).toContain("TikTok");
  });

  it("includes the tone guidance in the prompt", () => {
    const prompt = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    expect(prompt).toContain(TONES.cercano.guidance);
  });

  it("includes the output language rule", () => {
    const prompt = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    expect(prompt).toContain('"es"');
  });

  it("includes the JSON-only output rule", () => {
    const prompt = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    expect(prompt).toContain("SOLO el JSON");
    expect(prompt).toContain('{"title": "...", "description": "...", "hashtags":');
  });

  it("includes the faithfulness rule", () => {
    const prompt = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    expect(prompt).toContain("SOLO usa información que esté explícitamente en el transcript");
    expect(prompt).toContain("NO inventes hechos");
  });

  it("differs per platform — instagram vs tiktok", () => {
    const tikTok = buildSystemPrompt({ platform: "tiktok", tone: "cercano", language: "es" });
    const instagram = buildSystemPrompt({ platform: "instagram", tone: "cercano", language: "es" });
    expect(tikTok).toContain("TikTok");
    expect(instagram).toContain("Instagram Reels");
    expect(tikTok).not.toContain("Instagram Reels");
    expect(instagram).not.toContain("TikTok");
    // Platform-specific hashtag guidance differs
    expect(tikTok).toContain(PLATFORMS.tiktok.hashtagStyle);
    expect(instagram).toContain(PLATFORMS.instagram.hashtagStyle);
  });

  it("differs per platform — youtube_shorts", () => {
    const shorts = buildSystemPrompt({ platform: "youtube_shorts", tone: "profesional", language: "es" });
    expect(shorts).toContain("YouTube Shorts");
    expect(shorts).toContain(PLATFORMS.youtube_shorts.hashtagStyle);
  });

  it("differs per tone — profesional vs llamativo", () => {
    const prof = buildSystemPrompt({ platform: "tiktok", tone: "profesional", language: "es" });
    const llam = buildSystemPrompt({ platform: "tiktok", tone: "llamativo", language: "es" });
    expect(prof).toContain(TONES.profesional.guidance);
    expect(llam).toContain(TONES.llamativo.guidance);
    expect(prof).not.toContain(TONES.llamativo.guidance);
    expect(llam).not.toContain(TONES.profesional.guidance);
  });

  it("includes the language for non-Spanish transcripts", () => {
    const prompt = buildSystemPrompt({ platform: "youtube_shorts", tone: "profesional", language: "en" });
    expect(prompt).toContain('"en"');
  });

  it("includes max description chars for the platform", () => {
    const prompt = buildSystemPrompt({ platform: "youtube_shorts", tone: "cercano", language: "es" });
    expect(prompt).toContain("5000");
  });
});

// ─── MetadataSchema / sanitizeMetadata ────────────────────────────────────────

describe("MetadataSchema", () => {
  it("validates a correct metadata object", () => {
    const result = MetadataSchema.safeParse({
      title: "Actualizá tu sitio web ahora",
      description: "Google cambia su algoritmo. Conocé las 3 claves para no perder posicionamiento.",
      hashtags: ["#SEO", "#GoogleAlgorithm", "#WebDesign"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a title longer than 120 chars", () => {
    const result = MetadataSchema.safeParse({
      title: "a".repeat(121),
      description: "desc",
      hashtags: ["#tag"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = MetadataSchema.safeParse({
      title: "",
      description: "desc",
      hashtags: ["#tag"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 5000 chars (schema absolute cap)", () => {
    // Per-platform enforcement (tiktok/instagram at 2200, shorts at 5000) is
    // handled in sanitizeMetadata BEFORE the schema runs. The schema's max(5000)
    // is the absolute ceiling that catches truly unbounded model output.
    const result = MetadataSchema.safeParse({
      title: "title",
      description: "d".repeat(5001),
      hashtags: ["#tag"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects hashtags without leading #", () => {
    const result = MetadataSchema.safeParse({
      title: "title",
      description: "desc",
      hashtags: ["notahashtag"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects hashtags with spaces", () => {
    const result = MetadataSchema.safeParse({
      title: "title",
      description: "desc",
      hashtags: ["#hola mundo"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts hashtags with unicode letters (Spanish)", () => {
    const result = MetadataSchema.safeParse({
      title: "title",
      description: "desc",
      hashtags: ["#DiseñoWeb", "#Tecnología"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 12 hashtags", () => {
    const result = MetadataSchema.safeParse({
      title: "title",
      description: "desc",
      hashtags: Array.from({ length: 13 }, (_, i) => `#tag${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe("sanitizeMetadata", () => {
  it("returns valid metadata from a clean raw object", () => {
    const raw = {
      title: "Título de prueba",
      description: "Descripción válida de prueba",
      hashtags: ["#SEO", "#TechTips"],
    };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.title).toBe("Título de prueba");
    expect(result.hashtags).toEqual(["#SEO", "#TechTips"]);
  });

  it("trims whitespace from title", () => {
    const raw = { title: "  Titulo con espacios  ", description: "desc", hashtags: ["#tag"] };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.title).toBe("Titulo con espacios");
  });

  it("caps hashtags to ≤8", () => {
    const raw = {
      title: "title",
      description: "desc",
      hashtags: Array.from({ length: 10 }, (_, i) => `#tag${i}`),
    };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.hashtags.length).toBeLessThanOrEqual(8);
  });

  it("deduplicates hashtags case-insensitively", () => {
    const raw = {
      title: "title",
      description: "desc",
      hashtags: ["#SEO", "#seo", "#Seo", "#Google"],
    };
    const result = sanitizeMetadata(raw, "tiktok");
    const lower = result.hashtags.map((h) => h.toLowerCase());
    const uniqueLower = [...new Set(lower)];
    expect(lower.length).toBe(uniqueLower.length);
    expect(result.hashtags.length).toBe(2);
  });

  it("drops hashtags with spaces", () => {
    const raw = {
      title: "title",
      description: "desc",
      hashtags: ["#hola mundo", "#valido", "#con espacio"],
    };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.hashtags).toEqual(["#valido"]);
  });

  it("adds leading # to hashtags missing it", () => {
    const raw = {
      title: "title",
      description: "desc",
      hashtags: ["seo", "google"],
    };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.hashtags).toEqual(["#seo", "#google"]);
  });

  it("truncates description to platform descMaxChars (tiktok = 2200)", () => {
    const raw = {
      title: "title",
      description: "d".repeat(3000),
      hashtags: ["#tag"],
    };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.description.length).toBeLessThanOrEqual(2200);
  });

  it("does not truncate description within platform limit", () => {
    const desc = "d".repeat(100);
    const raw = { title: "title", description: desc, hashtags: ["#tag"] };
    const result = sanitizeMetadata(raw, "tiktok");
    expect(result.description.length).toBe(100);
  });

  it("throws MetadataValidationError for non-object input", () => {
    expect(() => sanitizeMetadata(null, "tiktok")).toThrow(MetadataValidationError);
    expect(() => sanitizeMetadata("string", "tiktok")).toThrow(MetadataValidationError);
  });

  it("throws MetadataValidationError when title is missing after sanitization", () => {
    const raw = { title: "", description: "desc", hashtags: ["#tag"] };
    expect(() => sanitizeMetadata(raw, "tiktok")).toThrow(MetadataValidationError);
  });

  it("throws MetadataValidationError when hashtags array is empty after sanitization", () => {
    const raw = { title: "title", description: "desc", hashtags: ["invalid hashtag", "also invalid"] };
    expect(() => sanitizeMetadata(raw, "tiktok")).toThrow(MetadataValidationError);
  });

  it("applies youtube_shorts descMaxChars (5000) separately", () => {
    const raw = {
      title: "title",
      description: "d".repeat(4500),
      hashtags: ["#SEO"],
    };
    const result = sanitizeMetadata(raw, "youtube_shorts");
    expect(result.description.length).toBe(4500); // within limit — not truncated
  });
});

// ─── generateMetadata ─────────────────────────────────────────────────────────

describe("generateMetadata", () => {
  const VALID_RESPONSE = JSON.stringify({
    title: "Actualizá tu sitio web antes que sea tarde",
    description: "Google cambia su algoritmo. 3 cosas clave para no perder posicionamiento.",
    hashtags: ["#SEO", "#DiseñoWeb", "#Google", "#eCommerce"],
  });

  it("happy path: client returns valid JSON → returns parsed Metadata", async () => {
    const client: ChatClient = vi.fn().mockResolvedValue(VALID_RESPONSE);

    const result = await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "cercano",
      client,
    });

    expect(result.title).toBe("Actualizá tu sitio web antes que sea tarde");
    expect(result.hashtags).toContain("#SEO");
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("calls client with the extracted transcript text as user prompt", async () => {
    const client: ChatClient = vi.fn().mockResolvedValue(VALID_RESPONSE);

    await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "cercano",
      client,
    });

    const [call] = (client as ReturnType<typeof vi.fn>).mock.calls;
    expect(call[0].user).toContain("Dentro de muy poco");
    expect(call[0].user).toContain("Google está cambiando su algoritmo");
  });

  it("passes the correct system prompt containing platform + tone + language", async () => {
    const client: ChatClient = vi.fn().mockResolvedValue(VALID_RESPONSE);

    await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "instagram",
      tone: "profesional",
      client,
    });

    const [call] = (client as ReturnType<typeof vi.fn>).mock.calls;
    expect(call[0].system).toContain("Instagram Reels");
    expect(call[0].system).toContain(TONES.profesional.guidance);
    expect(call[0].system).toContain('"es"');
  });

  it("invalid-then-valid: returns result on first retry", async () => {
    const client: ChatClient = vi
      .fn()
      .mockResolvedValueOnce("not valid json {{{")
      .mockResolvedValueOnce(VALID_RESPONSE);

    const result = await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "llamativo",
      client,
    });

    expect(result.title).toBe("Actualizá tu sitio web antes que sea tarde");
    expect(client).toHaveBeenCalledTimes(2);
  });

  it("retry call includes corrective instruction", async () => {
    const client: ChatClient = vi
      .fn()
      .mockResolvedValueOnce("not valid json")
      .mockResolvedValueOnce(VALID_RESPONSE);

    await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "cercano",
      client,
    });

    const retryCall = (client as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(retryCall[0].user).toContain("Devolvé SOLO el JSON válido");
  });

  it("invalid-twice: throws MetadataValidationError after two attempts", async () => {
    const client: ChatClient = vi
      .fn()
      .mockResolvedValueOnce("not valid json")
      .mockResolvedValueOnce("also not valid json");

    await expect(
      generateMetadata({
        transcript: SPANISH_TRANSCRIPT,
        platform: "tiktok",
        tone: "cercano",
        client,
      })
    ).rejects.toThrow(MetadataValidationError);

    expect(client).toHaveBeenCalledTimes(2);
  });

  it("throws MetadataValidationError when second attempt is valid JSON but fails zod", async () => {
    const invalidMetadataJson = JSON.stringify({ title: "", description: "", hashtags: [] });
    const client: ChatClient = vi
      .fn()
      .mockResolvedValueOnce("bad json")
      .mockResolvedValueOnce(invalidMetadataJson);

    await expect(
      generateMetadata({
        transcript: SPANISH_TRANSCRIPT,
        platform: "tiktok",
        tone: "cercano",
        client,
      })
    ).rejects.toThrow(MetadataValidationError);

    expect(client).toHaveBeenCalledTimes(2);
  });

  it("throws EmptyTranscriptError for null transcript — client never called", async () => {
    const client: ChatClient = vi.fn();

    await expect(
      generateMetadata({
        transcript: null,
        platform: "tiktok",
        tone: "cercano",
        client,
      })
    ).rejects.toThrow(EmptyTranscriptError);

    expect(client).not.toHaveBeenCalled();
  });

  it("throws EmptyTranscriptError for empty segments array — client never called", async () => {
    const client: ChatClient = vi.fn();

    await expect(
      generateMetadata({
        transcript: { language: "es", segments: [] },
        platform: "tiktok",
        tone: "cercano",
        client,
      })
    ).rejects.toThrow(EmptyTranscriptError);

    expect(client).not.toHaveBeenCalled();
  });

  it("throws EmptyTranscriptError for transcript with all-empty segment texts", async () => {
    const client: ChatClient = vi.fn();

    await expect(
      generateMetadata({
        transcript: { language: "es", segments: [{ text: "" }, { text: "   " }] },
        platform: "tiktok",
        tone: "cercano",
        client,
      })
    ).rejects.toThrow(EmptyTranscriptError);

    expect(client).not.toHaveBeenCalled();
  });

  it("works with English transcript and english language in system prompt", async () => {
    const englishResponse = JSON.stringify({
      title: "Top productivity hacks for remote workers",
      description: "Two key strategies to stay focused while working from home.",
      hashtags: ["#Productivity", "#RemoteWork", "#WFH"],
    });
    const client: ChatClient = vi.fn().mockResolvedValue(englishResponse);

    const result = await generateMetadata({
      transcript: ENGLISH_TRANSCRIPT,
      platform: "youtube_shorts",
      tone: "profesional",
      client,
    });

    expect(result.title).toBe("Top productivity hacks for remote workers");
    const [call] = (client as ReturnType<typeof vi.fn>).mock.calls;
    expect(call[0].system).toContain('"en"');
  });

  it("sanitizes hashtags returned by the model (dedupe + cap)", async () => {
    const messyResponse = JSON.stringify({
      title: "Título correcto",
      description: "Desc correcta",
      hashtags: [
        "#SEO", "#seo", "#SEO",          // duplicates
        "#tag1", "#tag2", "#tag3",        // more
        "#tag4", "#tag5", "#tag6",        // over 8 after dedup
        "#tag7",
      ],
    });
    const client: ChatClient = vi.fn().mockResolvedValue(messyResponse);

    const result = await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "cercano",
      client,
    });

    expect(result.hashtags.length).toBeLessThanOrEqual(8);
    // #seo and #SEO should be deduped
    const lower = result.hashtags.map((h) => h.toLowerCase());
    const uniqueLower = [...new Set(lower)];
    expect(lower.length).toBe(uniqueLower.length);
  });

  it("does not throw when first attempt JSON is valid but sanitize fails, then retry succeeds", async () => {
    // First attempt: valid JSON but fails sanitize (empty title)
    const badMetadata = JSON.stringify({ title: "", description: "desc", hashtags: ["#tag"] });
    const client: ChatClient = vi
      .fn()
      .mockResolvedValueOnce(badMetadata)
      .mockResolvedValueOnce(VALID_RESPONSE);

    const result = await generateMetadata({
      transcript: SPANISH_TRANSCRIPT,
      platform: "tiktok",
      tone: "cercano",
      client,
    });

    expect(result.title).toBe("Actualizá tu sitio web antes que sea tarde");
    expect(client).toHaveBeenCalledTimes(2);
  });
});
