import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";
import { z } from "zod";

export const runtime = "edge";

const requestSchema = z.object({
  purchaseOrder: z.any().optional(),
  offer: z.any(),
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
            content: "You generate a supplier follow-up message. Review the supplier's offer, the decision guardrail trace, and the purchase order (if any). Produce a professional but firm follow-up message to the supplier (in Hinglish or Hindi) explaining the decision, pointing out any rejected terms, and requesting action if needed."
          },
          {
            role: "user",
            content: JSON.stringify({
              offer: parsed.data.offer,
              decision: parsed.data.decision,
              purchaseOrder: parsed.data.purchaseOrder,
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
      followUp: content.trim(),
      provider: "sarvam-30b",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
