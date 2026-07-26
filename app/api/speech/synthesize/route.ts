import { z } from "zod";
import { speechLanguageSchema } from "@/lib/domain";
import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";

export const runtime = "edge";

const requestSchema = z.object({
  text: z.string().min(1).max(1400),
  language: speechLanguageSchema.default("en-IN"),
  translateFromEnglish: z.boolean().default(false),
  telephony: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  try {
    const { text, language, translateFromEnglish, telephony } = parsed.data;
    let spokenText = text;
    if (translateFromEnglish && language !== "en-IN") {
      const translationModel =
        process.env.SARVAM_TRANSLATION_MODEL || "mayura:v1";
      const translationResponse = await sarvamFetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          source_language_code: "en-IN",
          target_language_code: language,
          mode: translationModel === "sarvam-translate:v1"
            ? "formal"
            : "modern-colloquial",
          model: translationModel,
          numerals_format: "international",
        }),
      });
      const translation = (await translationResponse.json()) as {
        translated_text?: string;
      };
      if (!translation.translated_text) {
        throw new Error("Sarvam returned an empty brief translation.");
      }
      spokenText = translation.translated_text;
    }
    const speaker =
      language === "te-IN" ? "kavitha" : language === "ta-IN" ? "priya" : "shubh";
    const response = await sarvamFetch("/text-to-speech/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: spokenText,
        target_language_code: language,
        speaker,
        pace: telephony ? 1.08 : 1,
        speech_sample_rate: telephony ? 8000 : 24000,
        model: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
        temperature: 0.4,
        output_audio_codec: telephony ? "mulaw" : "mp3",
      }),
    });

    return new Response(response.body, {
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ||
          (telephony ? "audio/basic" : "audio/mpeg"),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
