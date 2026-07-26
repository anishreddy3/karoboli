import { z } from "zod";
import { speechLanguageSchema } from "@/lib/domain";
import {
  providerErrorResponse,
  sarvamFetch,
} from "@/lib/sarvam-server";

export const runtime = "edge";

const requestSchema = z.object({
  text: z.string().min(1).max(2000),
  sourceLanguage: z
    .union([speechLanguageSchema, z.literal("auto")])
    .default("auto"),
});

async function polishCommercialTranslation(
  sourceText: string,
  translatedText: string,
) {
  try {
    const response = await sarvamFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.SARVAM_CHAT_MODEL || "sarvam-30b",
        reasoning_effort: null,
        temperature: 0,
        max_tokens: 300,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "commercial_translation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["translation"],
              properties: {
                translation: { type: "string" },
              },
            },
          },
        },
        messages: [
          {
            role: "system",
            content: [
              "Rewrite a machine translation as concise, natural Indian business English.",
              "Preserve every quantity, grade, product, place, date, amount, currency, and payment term exactly.",
              "Resolve common code-mixed procurement phrases semantically; for example, payment at delivery means payment on delivery.",
              "Do not add facts, explanations, quotation marks, or labels.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              source: sourceText,
              machineTranslation: translatedText,
            }),
          },
        ],
      }),
    });
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) return translatedText;
    const parsed = z
      .object({ translation: z.string().min(1).max(2400) })
      .safeParse(JSON.parse(content));
    return parsed.success ? parsed.data.translation : translatedText;
  } catch (error) {
    console.warn(
      "Sarvam translation polishing failed; using the literal translation.",
      error instanceof Error ? error.message : String(error),
    );
    return translatedText;
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid translation request." }, { status: 400 });
  }

  try {
    if (parsed.data.sourceLanguage === "en-IN") {
      return Response.json({
        translation: parsed.data.text,
        sourceLanguage: "en-IN",
      });
    }
    const translationModel =
      parsed.data.sourceLanguage === "auto"
        ? "mayura:v1"
        : process.env.SARVAM_TRANSLATION_MODEL || "mayura:v1";
    const response = await sarvamFetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: parsed.data.text,
        source_language_code: parsed.data.sourceLanguage,
        target_language_code: "en-IN",
        mode:
          translationModel === "sarvam-translate:v1"
            ? "formal"
            : "modern-colloquial",
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
    const translation = await polishCommercialTranslation(
      parsed.data.text,
      data.translated_text,
    );
    return Response.json({
      translation,
      sourceLanguage: data.source_language_code || "unknown",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
