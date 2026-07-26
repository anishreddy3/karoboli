import { z } from "zod";
import { languageSchema } from "@/lib/domain";
import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";

export const runtime = "edge";

const requestSchema = z.object({
  text: z.string().min(1).max(1400),
  language: languageSchema.default("hi-IN"),
  telephony: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid speech request." }, { status: 400 });
  }

  try {
    const { text, language, telephony } = parsed.data;
    const speaker =
      language === "te-IN" ? "kavitha" : language === "ta-IN" ? "anbu" : "shubh";
    const response = await sarvamFetch("/text-to-speech/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
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

