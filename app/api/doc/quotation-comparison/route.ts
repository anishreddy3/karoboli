import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";
import { z } from "zod";

export const runtime = "edge";

const requestSchema = z.object({
  offers: z.array(z.any()),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const response = await sarvamFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sarvam-30b",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You generate a markdown quotation comparison table. Review the provided supplier offers. Produce a markdown table comparing the offers side-by-side on key dimensions like price, delivery date, payment terms, and inclusions. Highlight the best offer."
          },
          {
            role: "user",
            content: JSON.stringify({
              offers: parsed.data.offers,
            })
          }
        ],
      }),
    });

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Sarvam returned no content.");
    }

    return Response.json({
      comparison: content.trim(),
      provider: "sarvam-30b",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
