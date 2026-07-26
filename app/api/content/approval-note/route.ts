import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";
import { z } from "zod";

export const runtime = "edge";

const requestSchema = z.object({
  purchaseOrder: z.any(),
  decision: z.any(),
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
            content: "You generate an approval note for a purchase order. Review the purchase order and the decision guardrail trace. Produce a concise, professional summary to a human manager explaining why this purchase order needs approval or was auto-accepted, and any key facts."
          },
          {
            role: "user",
            content: JSON.stringify({
              purchaseOrder: parsed.data.purchaseOrder,
              decision: parsed.data.decision,
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
      note: content.trim(),
      provider: "sarvam-30b",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
