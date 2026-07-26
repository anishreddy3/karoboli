import { z } from "zod";
import {
  providerErrorResponse,
  sarvamFetch,
} from "@/lib/sarvam-server";

export const runtime = "edge";

const requestSchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid translation request." }, { status: 400 });
  }

  try {
    // Mayura supports automatic source-language detection, which live
    // Samvaad transcript events do not provide.
    const translationModel = "mayura:v1";
    const response = await sarvamFetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: parsed.data.text,
        source_language_code: "auto",
        target_language_code: "en-IN",
        mode: "modern-colloquial",
        model: translationModel,
        numerals_format: "international",
      }),
    });
    const data = (await response.json()) as {
      translated_text?: string;
      source_language_code?: string;
    };
    if (!data.translated_text) {
      throw new Error("Sarvam returned an empty translation.");
    }
    return Response.json({
      translation: data.translated_text,
      sourceLanguage: data.source_language_code || "unknown",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
