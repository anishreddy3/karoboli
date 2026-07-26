import { providerErrorResponse, sarvamFetch } from "@/lib/sarvam-server";
import { z } from "zod";

export const runtime = "edge";

const requestSchema = z.object({
  buyerRequirement: z.any(),
  supplierOffer: z.any(),
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
            content: "You perform discrepancy detection between a buyer requirement and a supplier offer. Produce a structured list of discrepancies (e.g. differences in quantity, missing inclusions like freight/unloading/GST, differing delivery dates, or mismatched payment terms)."
          },
          {
            role: "user",
            content: JSON.stringify({
              buyerRequirement: parsed.data.buyerRequirement,
              supplierOffer: parsed.data.supplierOffer,
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
      discrepancies: content.trim(),
      provider: "sarvam-30b",
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
